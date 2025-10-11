import mongoose from 'mongoose';
import Patient from '../models/patientModel.js';
import User from '../models/userModel.js';
import ReceptionistBilling from '../models/receptionistBillingModel.js';

// @desc    Create new receptionist billing record
// @route   POST /api/receptionist-billing
// @access  Private (Receptionist only)
export const createReceptionistBilling = async (req, res) => {
  try {
    const {
      patientId,
      doctorId,
      billingType,
      amount,
      paymentMethod,
      notes = '',
      additionalCharges = 0
    } = req.body;

    // Validate required fields
    if (!patientId || !billingType || !amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID, billing type, amount, and payment method are required'
      });
    }

    // Validate patient exists
    const patient = await Patient.findById(patientId)
      .populate('doctorId', 'firstName lastName')
      .populate('centerId', 'name centerCode');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Validate doctor exists (if required)
    let doctor = null;
    if (doctorId && (billingType === 'consultation' || billingType === 'reassignment')) {
      doctor = await User.findById(doctorId);
      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Doctor not found'
        });
      }
    }

    // Generate billing number
    const billingNumber = `REC-BILL-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Calculate total amount
    const totalAmount = amount + additionalCharges;

    // Create billing record
    const billingData = {
      billingNumber,
      patientId,
      doctorId: doctorId || null,
      centerId: req.user.centerId,
      billingType,
      baseAmount: amount,
      additionalCharges,
      totalAmount,
      paymentMethod,
      paymentStatus: 'paid', // Receptionist billing is always paid upfront
      notes,
      processedBy: req.user.id,
      billingDate: new Date()
    };

    const billing = new ReceptionistBilling(billingData);
    await billing.save();

    // Populate the response
    const populatedBilling = await ReceptionistBilling.findById(billing._id)
      .populate('patientId', 'name contactNumber email dateOfBirth')
      .populate('doctorId', 'firstName lastName specialization')
      .populate('centerId', 'name centerCode')
      .populate('processedBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Billing record created successfully',
      data: populatedBilling
    });

  } catch (error) {
    console.error('Create receptionist billing error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating billing record',
      error: error.message
    });
  }
};

// @desc    Get receptionist billing records
// @route   GET /api/receptionist-billing
// @access  Private (Receptionist, Admin, superAdmin)
export const getReceptionistBillingRecords = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    let filter = {};

    // Filter by center for non-superAdmin users
    if (req.user.role !== 'superAdmin') {
      filter.centerId = req.user.centerId;
    }

    // Filter by billing type
    if (req.query.billingType) {
      filter.billingType = req.query.billingType;
    }

    // Filter by payment method
    if (req.query.paymentMethod) {
      filter.paymentMethod = req.query.paymentMethod;
    }

    // Date range filter
    if (req.query.startDate && req.query.endDate) {
      filter.billingDate = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    }

    // Search by billing number or patient name
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { billingNumber: searchRegex },
        { 'patientId.name': searchRegex }
      ];
    }

    const billingRecords = await ReceptionistBilling.find(filter)
      .populate('patientId', 'name contactNumber email')
      .populate('doctorId', 'firstName lastName specialization')
      .populate('centerId', 'name centerCode')
      .populate('processedBy', 'firstName lastName')
      .sort({ billingDate: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ReceptionistBilling.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: billingRecords,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Get receptionist billing records error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching billing records',
      error: error.message
    });
  }
};

// @desc    Get receptionist billing statistics
// @route   GET /api/receptionist-billing/stats
// @access  Private (Receptionist, Admin, superAdmin)
export const getReceptionistBillingStats = async (req, res) => {
  try {
    let filter = {};

    // Filter by center for non-superAdmin users
    if (req.user.role !== 'superAdmin') {
      filter.centerId = req.user.centerId;
    }

    // Date range filter
    if (req.query.startDate && req.query.endDate) {
      filter.billingDate = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    }

    // Calculate statistics
    const [
      totalBills,
      totalRevenue,
      billingTypeStats,
      paymentMethodStats,
      dailyRevenue
    ] = await Promise.all([
      ReceptionistBilling.countDocuments(filter),
      ReceptionistBilling.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      ReceptionistBilling.aggregate([
        { $match: filter },
        { $group: { _id: '$billingType', count: { $sum: 1 }, total: { $sum: '$totalAmount' } } }
      ]),
      ReceptionistBilling.aggregate([
        { $match: filter },
        { $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$totalAmount' } } }
      ]),
      ReceptionistBilling.aggregate([
        { $match: filter },
        {
          $group: {
            _id: {
              year: { $year: '$billingDate' },
              month: { $month: '$billingDate' },
              day: { $dayOfMonth: '$billingDate' }
            },
            revenue: { $sum: '$totalAmount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 } },
        { $limit: 30 }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalBills,
          totalRevenue: totalRevenue[0]?.total || 0,
          averageBillAmount: totalBills > 0 ? (totalRevenue[0]?.total || 0) / totalBills : 0
        },
        billingTypeBreakdown: billingTypeStats,
        paymentMethodBreakdown: paymentMethodStats,
        dailyRevenue
      }
    });

  } catch (error) {
    console.error('Get receptionist billing stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching billing statistics',
      error: error.message
    });
  }
};

// @desc    Get single receptionist billing record
// @route   GET /api/receptionist-billing/:id
// @access  Private (Receptionist, Admin, superAdmin)
export const getReceptionistBillingById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid billing ID'
      });
    }

    let filter = { _id: id };

    // Filter by center for non-superAdmin users
    if (req.user.role !== 'superAdmin') {
      filter.centerId = req.user.centerId;
    }

    const billing = await ReceptionistBilling.findOne(filter)
      .populate('patientId', 'name contactNumber email dateOfBirth')
      .populate('doctorId', 'firstName lastName specialization')
      .populate('centerId', 'name centerCode')
      .populate('processedBy', 'firstName lastName');

    if (!billing) {
      return res.status(404).json({
        success: false,
        message: 'Billing record not found'
      });
    }

    res.status(200).json({
      success: true,
      data: billing
    });

  } catch (error) {
    console.error('Get receptionist billing by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching billing record',
      error: error.message
    });
  }
};








