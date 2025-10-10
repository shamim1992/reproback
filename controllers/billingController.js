import Billing from '../models/billingModel.js';
import TestRequest from '../models/testRequestModel.js';
import Patient from '../models/patientModel.js';
import User from '../models/userModel.js';
import mongoose from 'mongoose';

// @desc    Create new billing record
// @route   POST /api/billing
// @access  Private (Receptionist, Admin)
export const createBilling = async (req, res) => {
  try {
    const {
      testRequestId,
      testItems,
      discount = 0,
      tax = 0,
      paymentMethod,
      notes = ''
    } = req.body;

    // Debug: Log the request body
    console.log('Create billing request body:', req.body);
    console.log('User making request:', req.user);
    console.log('User centerId details:', {
      centerId: req.user.centerId,
      centerIdType: typeof req.user.centerId,
      centerIdString: req.user.centerId?.toString(),
      centerIdId: req.user.centerId?._id
    });

    // Validate test request ID
    if (!testRequestId) {
      return res.status(400).json({
        success: false,
        message: 'Test request ID is required'
      });
    }

    // Validate test request exists
    const testRequest = await TestRequest.findById(testRequestId)
      .populate('patientId', 'name email contactNumber')
      .populate('doctorId', 'firstName lastName')
      .populate('centerId', 'name centerCode');

    console.log('Found test request:', testRequest ? 'Yes' : 'No');
    
    if (testRequest) {
      console.log('Test request details:');
      console.log('  ID:', testRequest._id);
      console.log('  CenterId (raw):', testRequest.centerId);
      console.log('  CenterId (populated):', testRequest.centerId);
      console.log('  Status:', testRequest.status);
    }

    if (!testRequest) {
      return res.status(404).json({
        success: false,
        message: 'Test request not found'
      });
    }

    // Validate populated data
    if (!testRequest.patientId) {
      return res.status(400).json({
        success: false,
        message: 'Test request missing patient data'
      });
    }

    if (!testRequest.doctorId) {
      return res.status(400).json({
        success: false,
        message: 'Test request missing doctor data'
      });
    }

    if (!testRequest.centerId) {
      return res.status(400).json({
        success: false,
        message: 'Test request missing center data'
      });
    }

    console.log('Test request validation passed');

    // Extract centerId for billing creation (needed for all users)
    const userCenterId = req.user.centerId?._id || req.user.centerId;
    const testRequestCenterId = testRequest.centerId?._id || testRequest.centerId;

    // Validate user center access
    if (req.user.role !== 'superAdmin') {
      if (!req.user.centerId) {
        console.log('❌ User centerId missing:', req.user.centerId);
        return res.status(400).json({
          success: false,
          message: 'User must be assigned to a center to create billing'
        });
      }
      
      console.log('🔍 Center validation check:');
      console.log('  User centerId:', req.user.centerId);
      console.log('  Test request centerId:', testRequest.centerId);
      console.log('  User centerId type:', typeof req.user.centerId);
      console.log('  Test request centerId type:', typeof testRequest.centerId);
      console.log('  User centerId _id:', req.user.centerId?._id);
      console.log('  Test request centerId _id:', testRequest.centerId?._id);
      
      const userCenterIdStr = userCenterId ? userCenterId.toString() : null;
      const testRequestCenterIdStr = testRequestCenterId ? testRequestCenterId.toString() : null;
      
      console.log('  User centerId toString:', userCenterIdStr);
      console.log('  Test request centerId toString:', testRequestCenterIdStr);
      console.log('  Are they equal?', testRequestCenterIdStr === userCenterIdStr);
      
      // Check if test request belongs to user's center
      if (!testRequest.centerId) {
        console.log('⚠️ Test request missing centerId - assigning user center');
        // Assign the user's center to the test request
        testRequest.centerId = userCenterId;
        await testRequest.save();
        console.log('✅ Test request centerId updated to:', req.user.centerId);
      } else if (testRequestCenterIdStr !== userCenterIdStr) {
        console.log('❌ Center mismatch - user cannot create billing for this test request');
        console.log('  User center:', userCenterIdStr);
        console.log('  Test request center:', testRequestCenterIdStr);
        return res.status(403).json({
          success: false,
          message: `You can only create billing for test requests from your center. This test request belongs to a different center.`
        });
      }
      
      console.log('✅ Center validation passed');
    }

    // Check if billing already exists for this test request
    const existingBilling = await Billing.findOne({ testRequest: testRequestId });
    if (existingBilling) {
      return res.status(400).json({
        success: false,
        message: 'Billing already exists for this test request'
      });
    }

    // Validate test items
    if (!testItems || testItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Test items are required'
      });
    }

    // Validate each test item
    for (let i = 0; i < testItems.length; i++) {
      const item = testItems[i];
      if (!item.testName || !item.testCode) {
        return res.status(400).json({
          success: false,
          message: `Test item ${i + 1}: testName and testCode are required`
        });
      }
      if (typeof item.price !== 'number' || item.price <= 0) {
        return res.status(400).json({
          success: false,
          message: `Test item ${i + 1}: price must be a positive number`
        });
      }
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: `Test item ${i + 1}: quantity must be a positive number`
        });
      }
    }

    console.log('Test items validation passed');

    // Create billing record
    const billingData = {
      testRequest: testRequestId,
      patient: testRequest.patientId._id,
      doctor: testRequest.doctorId._id,
      center: testRequestCenterId || testRequest.centerId._id,
      testItems,
      discount,
      tax,
      paymentMethod,
      notes,
      createdBy: req.user.id,
      workflow: {
        currentStage: 'billing',
        stages: [{
          stage: 'billing',
          status: 'in_progress',
          updatedBy: req.user.id,
          notes: 'Billing created'
        }]
      }
    };

    // Debug: Log the billing data before creation
    console.log('Billing data to create:', billingData);

    const billing = new Billing(billingData);
    await billing.save();

    // Debug: Log successful creation
    console.log('Billing created successfully:', billing._id);

    // Update test request status and link billing
    await TestRequest.findByIdAndUpdate(testRequestId, {
      status: 'Billing_Generated',
      billingId: billing._id
    });

    // Populate the created billing
    await billing.populate([
      { path: 'testRequest', select: 'testType status' },
      { path: 'patient', select: 'name email contactNumber' },
      { path: 'doctor', select: 'firstName lastName' },
      { path: 'center', select: 'name centerCode' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Billing created successfully',
      data: billing
    });

  } catch (error) {
    console.error('Create billing error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    
    // Check for specific MongoDB errors
    if (error.name === 'ValidationError') {
      console.error('Validation errors:', error.errors);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.keys(error.errors).map(key => ({
          field: key,
          message: error.errors[key].message
        }))
      });
    }
    
    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      console.error('MongoDB error:', error.message);
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Duplicate entry error',
          error: error.message
        });
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while creating billing',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get all billing records with pagination and filters
// @route   GET /api/billing
// @access  Private
export const getBillingRecords = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    let filter = { isActive: true };
    
    // Filter by center for non-superAdmin users
    if (req.user.role !== 'superAdmin') {
      filter.center = req.user.centerId;
    }

    // Filter by payment status
    if (req.query.paymentStatus) {
      filter.paymentStatus = req.query.paymentStatus;
    }

    // Filter by billing status
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // Filter by workflow stage
    if (req.query.workflowStage) {
      filter['workflow.currentStage'] = req.query.workflowStage;
    }

    // Filter by center
    if (req.query.center) {
      filter.center = req.query.center;
    }

    // Date range filter
    if (req.query.startDate && req.query.endDate) {
      filter.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    }

    // Search by bill number or patient name
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { billNumber: searchRegex },
        { 'patient.name': searchRegex }
      ];
    }

    const billingRecords = await Billing.find(filter)
      .populate('testRequest', 'testType status')
      .populate('patient', 'name email contactNumber uhid')
      .populate('doctor', 'firstName lastName')
      .populate('center', 'name centerCode')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Billing.countDocuments(filter);

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
    console.error('Get billing records error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching billing records',
      error: error.message
    });
  }
};

// @desc    Get single billing record by ID
// @route   GET /api/billing/:id
// @access  Private
export const getBillingById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid billing ID'
      });
    }

    let filter = { _id: id, isActive: true };
    
    // Filter by center for non-superAdmin users
    if (req.user.role !== 'superAdmin') {
      filter.center = req.user.centerId;
    }

    const billing = await Billing.findOne(filter)
      .populate('testRequest', 'testType status notes')
      .populate('patient', 'name email contactNumber dateOfBirth gender address uhid')
      .populate('doctor', 'firstName lastName email')
      .populate('center', 'name centerCode address contactNumber')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

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
    console.error('Get billing by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching billing record',
      error: error.message
    });
  }
};

// @desc    Update billing record
// @route   PUT /api/billing/:id
// @access  Private (Receptionist, Admin)
export const updateBilling = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid billing ID'
      });
    }

    let filter = { _id: id, isActive: true };
    
    // Filter by center for non-superAdmin users
    if (req.user.role !== 'superAdmin') {
      filter.center = req.user.centerId;
    }

    const existingBilling = await Billing.findOne(filter);
    if (!existingBilling) {
      return res.status(404).json({
        success: false,
        message: 'Billing record not found'
      });
    }

    // Check if billing can be updated
    if (existingBilling.paymentStatus === 'paid' || existingBilling.paymentStatus === 'cancelled' || existingBilling.paymentStatus === 'refunded') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update bills that are paid, cancelled, or refunded'
      });
    }

    // Prepare update data
    const updateData = {
      updatedBy: req.user.id,
      updatedAt: new Date()
    };

    // Update fields if provided
    if (req.body.totalAmount !== undefined) {
      updateData.totalAmount = req.body.totalAmount;
      updateData.remainingAmount = req.body.totalAmount - (existingBilling.paidAmount || 0);
    }
    if (req.body.discount !== undefined) {
      updateData.discount = req.body.discount;
    }
    if (req.body.tax !== undefined) {
      updateData.tax = req.body.tax;
    }
    if (req.body.notes !== undefined) {
      updateData.notes = req.body.notes;
    }
    if (req.body.paymentStatus !== undefined) {
      updateData.paymentStatus = req.body.paymentStatus;
    }

    console.log('Updating billing with data:', updateData);

    const updatedBilling = await Billing.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('testRequest', 'testType status')
      .populate('patient', 'name email contactNumber uhid')
      .populate('doctor', 'firstName lastName')
      .populate('center', 'name centerCode')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    res.status(200).json({
      success: true,
      message: 'Billing record updated successfully',
      data: updatedBilling
    });

  } catch (error) {
    console.error('Update billing error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating billing record',
      error: error.message
    });
  }
};

// @desc    Process payment for billing
// @route   POST /api/billing/:id/payment
// @access  Private (Receptionist, Admin)
export const processPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { paidAmount, paymentMethod, notes = '' } = req.body;

    console.log('Processing payment for billing ID:', id);
    console.log('User:', req.user.id, 'Role:', req.user.role, 'Center:', req.user.centerId);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid billing ID'
      });
    }

    // First check if billing exists without center filter
    const billingExists = await Billing.findOne({ _id: id });
    console.log('Billing exists:', !!billingExists);
    if (billingExists) {
      console.log('Billing center:', billingExists.center);
      console.log('Billing isActive:', billingExists.isActive);
      console.log('Billing status:', billingExists.status);
    }

    let filter = { _id: id, isActive: true };
    
    // Filter by center for non-superAdmin users
    if (req.user.role !== 'superAdmin') {
      filter.center = req.user.centerId;
      console.log('Applying center filter:', filter.center);
    }

    const billing = await Billing.findOne(filter);
    if (!billing) {
      console.log('Billing not found with filter:', filter);
      
      // Provide more specific error message
      if (billingExists && billingExists.center && req.user.centerId && 
          billingExists.center.toString() !== req.user.centerId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Billing belongs to a different center'
        });
      }
      
      if (billingExists && !billingExists.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Billing record is inactive'
        });
      }
      
      return res.status(404).json({
        success: false,
        message: 'Billing record not found'
      });
    }

    console.log('Billing found, proceeding with payment');

    // Validate payment amount
    if (paidAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be greater than 0'
      });
    }

    if (paidAmount > billing.totalAmount) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount cannot exceed total amount'
      });
    }

    // Update payment information
    const newPaidAmount = billing.paidAmount + paidAmount;
    const remainingAmount = billing.totalAmount - newPaidAmount;

    // Determine payment status based on remaining amount
    let paymentStatus = 'partial';
    if (remainingAmount <= 0) {
      // Bill is fully paid
      paymentStatus = 'paid';
    }

    // Generate receipt number for this payment
    const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // Create payment history entry
    const paymentEntry = {
      amount: paidAmount,
      paymentMethod,
      paymentDate: new Date(),
      processedBy: req.user.id,
      notes: notes || `Payment of ${paidAmount} processed`,
      receiptNumber
    };

    // Update workflow stage
    let currentStage = billing.workflow.currentStage;
    if (paymentStatus === 'paid' && currentStage === 'payment') {
      currentStage = 'lab_processing';
    }

    // Add workflow stage update
    const workflowUpdate = {
      stage: 'payment',
      status: paymentStatus === 'paid' ? 'completed' : 'in_progress',
      updatedBy: req.user.id,
      notes: notes || `Payment of ${paidAmount} processed (Receipt: ${receiptNumber})`
    };

    const updatedBilling = await Billing.findByIdAndUpdate(
      id,
      {
        paidAmount: newPaidAmount,
        paymentStatus,
        paymentMethod,
        paymentDate: new Date(),
        updatedBy: req.user.id,
        'workflow.currentStage': currentStage,
        $push: { 
          'workflow.stages': workflowUpdate,
          'paymentHistory': paymentEntry
        }
      },
      { new: true }
    );

    // Update test request status based on payment
    if (paymentStatus === 'paid') {
      await TestRequest.findByIdAndUpdate(billing.testRequest, {
        status: 'Billing_Paid'
      });
    } else if (paymentStatus === 'partial') {
      await TestRequest.findByIdAndUpdate(billing.testRequest, {
        status: 'Billing_Generated' // Keep as billing generated for partial payments
      });
    }

    // Populate the updated billing
    await updatedBilling.populate([
      { path: 'testRequest', select: 'testType status' },
      { path: 'patient', select: 'name email contactNumber' },
      { path: 'doctor', select: 'firstName lastName' },
      { path: 'center', select: 'name centerCode' },
      { path: 'createdBy', select: 'firstName lastName' },
      { path: 'updatedBy', select: 'firstName lastName' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Payment processed successfully',
      data: updatedBilling
    });

  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing payment',
      error: error.message
    });
  }
};

// @desc    Update workflow stage
// @route   PUT /api/billing/:id/workflow
// @access  Private (Admin, Doctor, Lab Staff)
export const updateWorkflowStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { stage, status, notes = '' } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid billing ID'
      });
    }

    const validStages = ['billing', 'payment', 'lab_processing', 'completed'];
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];

    if (!validStages.includes(stage) || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid stage or status'
      });
    }

    let filter = { _id: id, isActive: true };
    
    // Filter by center for non-superAdmin users
    if (req.user.role !== 'superAdmin') {
      filter.center = req.user.centerId;
    }

    const billing = await Billing.findOne(filter);
    if (!billing) {
      return res.status(404).json({
        success: false,
        message: 'Billing record not found'
      });
    }

    // Add workflow stage update
    const workflowUpdate = {
      stage,
      status,
      updatedBy: req.user.id,
      notes
    };

    const updatedBilling = await Billing.findByIdAndUpdate(
      id,
      {
        'workflow.currentStage': stage,
        updatedBy: req.user.id,
        $push: { 'workflow.stages': workflowUpdate }
      },
      { new: true }
    )
      .populate('testRequest', 'testType status')
      .populate('patient', 'name email contactNumber')
      .populate('doctor', 'firstName lastName')
      .populate('center', 'name centerCode')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    res.status(200).json({
      success: true,
      message: 'Workflow stage updated successfully',
      data: updatedBilling
    });

  } catch (error) {
    console.error('Update workflow stage error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating workflow stage',
      error: error.message
    });
  }
};

// @desc    Get billing statistics
// @route   GET /api/billing/stats/summary
// @access  Private (Admin, superAdmin)
export const getBillingStats = async (req, res) => {
  try {
    let filter = { isActive: true };
    
    // Filter by center for non-superAdmin users
    if (req.user.role !== 'superAdmin') {
      filter.center = req.user.centerId;
    }

    // Date range filter if provided
    if (req.query.startDate && req.query.endDate) {
      filter.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    }

    const stats = await Billing.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          paidAmount: { $sum: '$paidAmount' },
          pendingAmount: { $sum: { $subtract: ['$totalAmount', '$paidAmount'] } },
          paidBills: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] }
          },
          pendingBills: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0] }
          },
          partialBills: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'partial'] }, 1, 0] }
          }
        }
      }
    ]);


    // Payment method distribution
    const paymentMethodStats = await Billing.aggregate([
      { $match: filter },
      { $group: { _id: '$paymentMethod', count: { $sum: 1 }, totalAmount: { $sum: '$totalAmount' } } }
    ]);

    // Daily revenue for the last 30 days
    const dailyRevenue = await Billing.aggregate([
      { $match: { ...filter, paymentStatus: 'paid' } },
      {
        $group: {
          _id: {
            year: { $year: '$paymentDate' },
            month: { $month: '$paymentDate' },
            day: { $dayOfMonth: '$paymentDate' }
          },
          revenue: { $sum: '$paidAmount' },
          bills: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      { $limit: 30 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: stats[0] || {
          totalBills: 0,
          totalAmount: 0,
          paidAmount: 0,
          pendingAmount: 0,
          paidBills: 0,
          pendingBills: 0,
          partialBills: 0
        },
        paymentMethodStats,
        dailyRevenue
      }
    });

  } catch (error) {
    console.error('Get billing stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching billing statistics',
      error: error.message
    });
  }
};

// @desc    Delete billing record (soft delete)
// @route   DELETE /api/billing/:id
// @access  Private (Admin, superAdmin only)
export const deleteBilling = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid billing ID'
      });
    }

    let filter = { _id: id, isActive: true };
    
    // Filter by center for non-superAdmin users
    if (req.user.role !== 'superAdmin') {
      filter.center = req.user.centerId;
    }

    const billing = await Billing.findOne(filter);
    if (!billing) {
      return res.status(404).json({
        success: false,
        message: 'Billing record not found'
      });
    }

    // Soft delete
    await Billing.findByIdAndUpdate(id, {
      isActive: false,
      updatedBy: req.user.id
    });

    res.status(200).json({
      success: true,
      message: 'Billing record deleted successfully'
    });

  } catch (error) {
    console.error('Delete billing error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting billing record',
      error: error.message
    });
  }
};

// Get billing analytics
export const getBillingAnalytics = async (req, res) => {
  try {
    const { dateRange, startDate, endDate, centerId, paymentStatus } = req.query;
    
    console.log('Billing Analytics Request:', {
      user: req.user,
      query: req.query,
      dateRange,
      startDate,
      endDate,
      centerId
    });
    
    // Build date filter
    let dateFilter = {};
    const now = new Date();
    
    switch (dateRange) {
      case 'daily':
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
        dateFilter = { createdAt: { $gte: startOfDay, $lt: endOfDay } };
        break;
      case 'weekly':
        const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = { createdAt: { $gte: startOfWeek } };
        break;
      case 'monthly':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = { createdAt: { $gte: startOfMonth } };
        break;
      case 'yearly':
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        dateFilter = { createdAt: { $gte: startOfYear } };
        break;
      case 'custom':
        if (startDate && endDate) {
          dateFilter = { 
            createdAt: { 
              $gte: new Date(startDate), 
              $lte: new Date(endDate) 
            } 
          };
        }
        break;
      default:
        // Default to monthly
        const defaultStartOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = { createdAt: { $gte: defaultStartOfMonth } };
    }

    // Build base filter - EXCLUDE cancelled and refunded bills from analytics
    let filter = { 
      isActive: true,
      paymentStatus: { $nin: ['cancelled', 'refunded'] }, // Exclude cancelled and refunded bills
      ...dateFilter
    };
    
    // Filter by center
    if (centerId && centerId !== 'all') {
      // User explicitly selected a specific center - convert to ObjectId
      filter.center = new mongoose.Types.ObjectId(centerId);
    } else if (req.user.role !== 'superAdmin' && req.user.role !== 'Super Consultant') {
      // For non-superAdmin users, if no specific center is selected, use their assigned center
      if (!req.user.centerId) {
        return res.status(400).json({
          success: false,
          message: 'User must be assigned to a center to access billing analytics'
        });
      }
      filter.center = req.user.centerId;
    }
    // If centerId is 'all' and user is superAdmin/Super Consultant, no center filter is applied (shows all centers)

    // Filter by payment status
    if (paymentStatus && paymentStatus !== 'all') {
      filter.paymentStatus = paymentStatus;
    }

    console.log('Analytics Filter Applied:', filter);
    console.log('Center ID from query:', centerId);
    console.log('Center ID type:', typeof centerId);
    console.log('User role:', req.user.role);
    console.log('User center ID:', req.user.centerId);
    console.log('Filter center field:', filter.center);
    console.log('Filter center type:', typeof filter.center);

    // Test query to see what bills match the filter
    const testBills = await Billing.find(filter).limit(5);
    console.log('Test bills found:', testBills.length);
    if (testBills.length > 0) {
      console.log('Sample bill:', {
        _id: testBills[0]._id,
        center: testBills[0].center,
        totalAmount: testBills[0].totalAmount,
        paidAmount: testBills[0].paidAmount,
        paymentStatus: testBills[0].paymentStatus,
        paymentHistory: testBills[0].paymentHistory,
        paymentHistoryLength: testBills[0].paymentHistory?.length || 0
      });
    }

    // Get comprehensive analytics data
    const [
      totalRevenue,
      totalBillAmounts,
      totalBills,
      paidBills,
      pendingBills,
      partialBills,
      patientsSinglePayment,
      patientsMultiPayment,
      paymentMethodBreakdown,
      dailyRevenue,
      centerWiseData,
      paymentStatusBreakdown,
      monthlyTrend,
      topPatients,
      recentBills,
      cancelledBills,
      refundedBills,
      cancelledAmount,
      refundedAmount
    ] = await Promise.all([
      // Total revenue (using paidAmount for actual revenue received)
      Billing.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$paidAmount' } } }
      ]),
      
      // Total bill amounts (using totalAmount for bill values)
      Billing.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      
      // Total bills count
      Billing.countDocuments(filter),
      
      // Paid bills count
      Billing.countDocuments({ ...filter, paymentStatus: 'paid' }),
      
      // Pending bills count
      Billing.countDocuments({ ...filter, paymentStatus: 'pending' }),
      
      // Partial bills count
      Billing.countDocuments({ ...filter, paymentStatus: 'partial' }),
      
      // Patients who paid full in one go (single payment entry, paid status)
      Billing.aggregate([
        { $match: { ...filter, paymentStatus: 'paid' } },
        { $match: { 'paymentHistory': { $size: 1 } } }, // Has exactly 1 payment entry
        { $group: { _id: '$patient' } },
        { $count: 'count' }
      ]),
      
      // Patients who paid full through multiple partial payments (multiple payment entries, paid status)
      Billing.aggregate([
        { $match: { ...filter, paymentStatus: 'paid' } },
        { $match: { 'paymentHistory.1': { $exists: true } } }, // Has more than 1 payment entry
        { $group: { _id: '$patient' } },
        { $count: 'count' }
      ]),
      
      // Payment method breakdown
      Billing.aggregate([
        { $match: filter },
        { $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$totalAmount' } } }
      ]),
      
      // Daily revenue for the last 30 days
      Billing.aggregate([
        { 
          $match: { 
            ...filter,
            createdAt: { 
              $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) 
            } 
          } 
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            revenue: { $sum: '$totalAmount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]),

      // Center-wise data
      Billing.aggregate([
        { $match: filter },
        {
          $lookup: {
            from: 'centers',
            localField: 'center',
            foreignField: '_id',
            as: 'centerInfo'
          }
        },
        {
          $group: {
            _id: '$center',
            centerName: { $first: '$centerInfo.name' },
            centerCode: { $first: '$centerInfo.centerCode' },
            totalBills: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
            paidRevenue: { $sum: '$paidAmount' },
            pendingRevenue: { $sum: { $subtract: ['$totalAmount', '$paidAmount'] } },
            paidBills: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] } },
            partialBills: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'partial'] }, 1, 0] } },
            pendingBills: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0] } }
          }
        },
        { $sort: { totalRevenue: -1 } }
      ]),

      // Payment status breakdown with amounts
      Billing.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$paymentStatus',
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' },
            paidAmount: { $sum: '$paidAmount' },
            pendingAmount: { $sum: { $subtract: ['$totalAmount', '$paidAmount'] } }
          }
        }
      ]),

      // Monthly trend for the last 12 months
      Billing.aggregate([
        { 
          $match: { 
            ...filter,
            createdAt: { 
              $gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) 
            } 
          } 
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            revenue: { $sum: '$totalAmount' },
            paidAmount: { $sum: '$paidAmount' },
            bills: { $sum: 1 },
            paidBills: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] } },
            partialBills: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'partial'] }, 1, 0] } },
            pendingBills: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0] } }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),

      // Top patients by billing amount
      Billing.aggregate([
        { $match: filter },
        {
          $lookup: {
            from: 'patients',
            localField: 'patient',
            foreignField: '_id',
            as: 'patientInfo'
          }
        },
        {
          $lookup: {
            from: 'centers',
            localField: 'center',
            foreignField: '_id',
            as: 'centerInfo'
          }
        },
        {
          $group: {
            _id: '$patient',
            patientName: { $first: '$patientInfo.name' },
            patientUhid: { $first: '$patientInfo.uhid' },
            centerName: { $first: '$centerInfo.name' },
            totalBills: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' },
            paidAmount: { $sum: '$paidAmount' },
            pendingAmount: { $sum: { $subtract: ['$totalAmount', '$paidAmount'] } }
          }
        },
        { $sort: { totalAmount: -1 } },
        { $limit: 10 }
      ]),

      // Recent bills with details - INCLUDE ALL BILLS (active, cancelled, refunded)
      // Fetch up to 100 bills for pagination on frontend
      Billing.find({
        isActive: true,
        ...dateFilter,
        ...(centerId && centerId !== 'all' ? { center: new mongoose.Types.ObjectId(centerId) } : 
           (req.user.role !== 'superAdmin' && req.user.role !== 'Super Consultant' ? { center: req.user.centerId } : {}))
      })
        .populate('patient', 'name email contactNumber uhid')
        .populate('center', 'name centerCode')
        .populate('doctor', 'firstName lastName')
        .populate('paymentHistory.processedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(100),
      
      // Cancelled bills count (using paymentStatus)
      Billing.countDocuments({ 
        isActive: true, 
        paymentStatus: 'cancelled',
        ...dateFilter,
        ...(centerId && centerId !== 'all' ? { center: new mongoose.Types.ObjectId(centerId) } : 
           (req.user.role !== 'superAdmin' && req.user.role !== 'Super Consultant' ? { center: req.user.centerId } : {}))
      }),
      
      // Refunded bills count (using paymentStatus)
      Billing.countDocuments({ 
        isActive: true, 
        paymentStatus: 'refunded',
        ...dateFilter,
        ...(centerId && centerId !== 'all' ? { center: new mongoose.Types.ObjectId(centerId) } : 
           (req.user.role !== 'superAdmin' && req.user.role !== 'Super Consultant' ? { center: req.user.centerId } : {}))
      }),
      
      // Cancelled amount (using paymentStatus)
      Billing.aggregate([
        { 
          $match: { 
            isActive: true, 
            paymentStatus: 'cancelled',
            ...dateFilter,
            ...(centerId && centerId !== 'all' ? { center: new mongoose.Types.ObjectId(centerId) } : 
               (req.user.role !== 'superAdmin' && req.user.role !== 'Super Consultant' ? { center: req.user.centerId } : {}))
          } 
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      
      // Refunded amount (using paymentStatus and refundAmount field)
      Billing.aggregate([
        { 
          $match: { 
            isActive: true, 
            paymentStatus: 'refunded',
            ...dateFilter,
            ...(centerId && centerId !== 'all' ? { center: new mongoose.Types.ObjectId(centerId) } : 
               (req.user.role !== 'superAdmin' && req.user.role !== 'Super Consultant' ? { center: req.user.centerId } : {}))
          } 
        },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$refundAmount', '$paidAmount'] } } } }
      ])
    ]);

    console.log('Top patients raw data:', JSON.stringify(topPatients, null, 2));
    console.log('Cancelled bills count:', cancelledBills);
    console.log('Refunded bills count:', refundedBills);
    console.log('Cancelled amount:', cancelledAmount);
    console.log('Refunded amount:', refundedAmount);

    const analytics = {
      // Basic metrics
      totalRevenue: totalRevenue[0]?.total || 0,
      totalBillAmounts: totalBillAmounts[0]?.total || 0,
      totalBills: totalBills,
      paidBills: paidBills,
      pendingBills: pendingBills,
      partialBills: partialBills,
      patientsSinglePayment: patientsSinglePayment[0]?.count || 0,
      patientsMultiPayment: patientsMultiPayment[0]?.count || 0,
      averageBillAmount: totalBills > 0 ? (totalBillAmounts[0]?.total || 0) / totalBills : 0,
      
      // Cancelled and Refunded metrics
      cancelledBills: cancelledBills || 0,
      refundedBills: refundedBills || 0,
      cancelledAmount: cancelledAmount[0]?.total || 0,
      refundedAmount: refundedAmount[0]?.total || 0,
      
      // Payment status breakdown with amounts
      paymentStatusBreakdown: paymentStatusBreakdown.map(item => ({
        status: item._id,
        count: item.count,
        totalAmount: item.totalAmount,
        paidAmount: item.paidAmount,
        pendingAmount: item.pendingAmount
      })),
      
      // Payment method breakdown
      paymentMethodBreakdown: paymentMethodBreakdown.map(item => ({
        method: item._id,
        count: item.count,
        total: item.total
      })),
      
      // Daily revenue trend
      dailyRevenue: dailyRevenue.map(item => ({
        date: new Date(item._id.year, item._id.month - 1, item._id.day),
        revenue: item.revenue,
        count: item.count
      })),
      
      // Center-wise analytics
      centerWiseData: centerWiseData.map(item => ({
        centerId: item._id,
        centerName: item.centerName?.[0] || 'Unknown Center',
        centerCode: item.centerCode?.[0] || 'N/A',
        totalBills: item.totalBills,
        totalRevenue: item.totalRevenue,
        paidRevenue: item.paidRevenue,
        pendingRevenue: item.pendingRevenue,
        paidBills: item.paidBills,
        partialBills: item.partialBills,
        pendingBills: item.pendingBills
      })),
      
      // Monthly trend
      monthlyTrend: monthlyTrend.map(item => ({
        month: new Date(item._id.year, item._id.month - 1, 1),
        revenue: item.revenue,
        paidAmount: item.paidAmount,
        bills: item.bills,
        paidBills: item.paidBills,
        partialBills: item.partialBills,
        pendingBills: item.pendingBills
      })),
      
      // Top patients
      topPatients: topPatients.map(item => {
        console.log('Top patient item:', JSON.stringify(item, null, 2));
        return {
          patientId: item._id,
          patientName: item.patientName?.[0] || 'Unknown Patient',
          uhid: item.patientUhid?.[0] || 'N/A',
          centerName: item.centerName?.[0] || 'Unknown Center',
          totalBills: item.totalBills,
          totalAmount: item.totalAmount,
          paidAmount: item.paidAmount,
          pendingAmount: item.pendingAmount
        };
      }),
      
      // Recent bills
      recentBills: recentBills.map(bill => ({
        _id: bill._id,
        billNumber: bill.billNumber,
        patientName: bill.patient?.name || 'Unknown',
        patient: {
          uhid: bill.patient?.uhid || 'N/A',
          name: bill.patient?.name || 'Unknown'
        },
        centerName: bill.center?.name || 'Unknown',
        doctorName: bill.doctor ? `${bill.doctor.firstName} ${bill.doctor.lastName}` : 'Unknown',
        totalAmount: bill.totalAmount,
        paidAmount: bill.paidAmount,
        paymentStatus: bill.paymentStatus,
        paymentHistory: bill.paymentHistory || [],
        paymentDate: bill.paymentDate,
        createdAt: bill.createdAt
      }))
    };

    res.status(200).json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Get billing analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching billing analytics',
      error: error.message
    });
  }
};

// Get billing reports
export const getBillingReports = async (req, res) => {
  try {
    const { 
      dateRange, 
      startDate, 
      endDate, 
      centerId, 
      page = 1, 
      limit = 50,
      status,
      paymentMethod
    } = req.query;
    
    console.log('Billing Reports Request:', {
      user: req.user,
      query: req.query,
      dateRange,
      startDate,
      endDate,
      centerId,
      page,
      limit,
      status,
      paymentMethod
    });
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build date filter
    let dateFilter = {};
    const now = new Date();
    
    switch (dateRange) {
      case 'daily':
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
        dateFilter = { createdAt: { $gte: startOfDay, $lt: endOfDay } };
        break;
      case 'weekly':
        const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = { createdAt: { $gte: startOfWeek } };
        break;
      case 'monthly':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = { createdAt: { $gte: startOfMonth } };
        break;
      case 'yearly':
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        dateFilter = { createdAt: { $gte: startOfYear } };
        break;
      case 'custom':
        if (startDate && endDate) {
          dateFilter = { 
            createdAt: { 
              $gte: new Date(startDate), 
              $lte: new Date(endDate) 
            } 
          };
        }
        break;
      default:
        // Default to monthly
        const defaultStartOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = { createdAt: { $gte: defaultStartOfMonth } };
    }

    // Build base filter
    let filter = { 
      isActive: true,
      ...dateFilter
    };
    
    // Filter by center
    if (centerId && centerId !== 'all') {
      // User explicitly selected a specific center - convert to ObjectId
      filter.center = new mongoose.Types.ObjectId(centerId);
    } else if (req.user.role !== 'superAdmin' && req.user.role !== 'Super Consultant') {
      // For non-superAdmin users, if no specific center is selected, use their assigned center
      if (!req.user.centerId) {
        return res.status(400).json({
          success: false,
          message: 'User must be assigned to a center to access billing reports'
        });
      }
      filter.center = req.user.centerId;
    }
    // If centerId is 'all' and user is superAdmin/Super Consultant, no center filter is applied (shows all centers)

    // Filter by status
    if (status && status !== 'all') {
      filter.paymentStatus = status;
    }

    // Filter by payment method
    if (paymentMethod && paymentMethod !== 'all') {
      filter.paymentMethod = paymentMethod;
    }

    console.log('Reports Filter Applied:', filter);
    console.log('Center ID from query:', centerId);
    console.log('User role:', req.user.role);
    console.log('User center ID:', req.user.centerId);

    // Get reports with pagination
    const reports = await Billing.find(filter)
      .populate('testRequest', 'testType status notes')
      .populate('patient', 'name email contactNumber')
      .populate('doctor', 'firstName lastName')
      .populate('center', 'name centerCode')
      .populate('createdBy', 'firstName lastName')
      .populate('paymentHistory.processedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Billing.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        records: reports,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalRecords: total,
          hasNext: pageNum < Math.ceil(total / limitNum),
          hasPrev: pageNum > 1
        }
      }
    });

  } catch (error) {
    console.error('Get billing reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching billing reports',
      error: error.message
    });
  }
};

// @desc    Cancel billing record
// @route   POST /api/billing/:id/cancel
// @access  Private (Receptionist, Admin)
export const cancelBilling = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellationReason = 'Cancelled by user', refundAmount = 0 } = req.body;

    console.log('Cancelling billing ID:', id);
    console.log('User:', req.user.id, 'Role:', req.user.role);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid billing ID'
      });
    }

    let filter = { _id: id, isActive: true };
    
    // Filter by center for non-superAdmin users
    if (req.user.role !== 'superAdmin') {
      filter.center = req.user.centerId;
    }

    const billing = await Billing.findOne(filter);
    if (!billing) {
      return res.status(404).json({
        success: false,
        message: 'Billing record not found'
      });
    }

    // Check if already cancelled
    if (billing.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Billing is already cancelled'
      });
    }

    // Update billing status to cancelled
    const updatedBilling = await Billing.findByIdAndUpdate(
      id,
      {
        status: 'cancelled',
        paymentStatus: 'cancelled',
        updatedBy: req.user.id,
        cancellationReason,
        cancelledAt: new Date(),
        cancelledBy: req.user.id,
        refundAmount: refundAmount || billing.paidAmount,
        $push: {
          'workflow.stages': {
            stage: 'billing',
            status: 'cancelled',
            updatedBy: req.user.id,
            notes: cancellationReason
          }
        }
      },
      { new: true }
    ).populate([
      { path: 'testRequest', select: 'testType status' },
      { path: 'patient', select: 'name email contactNumber' },
      { path: 'doctor', select: 'firstName lastName' },
      { path: 'center', select: 'name centerCode' },
      { path: 'createdBy', select: 'firstName lastName' },
      { path: 'updatedBy', select: 'firstName lastName' }
    ]);

    // Update test request status to prevent it from going to lab
    if (billing.testRequest) {
      await TestRequest.findByIdAndUpdate(billing.testRequest, {
        status: 'Cancelled',
        notes: `Billing cancelled: ${cancellationReason}`
      });
      console.log('Test request updated to Cancelled status');
    }

    res.status(200).json({
      success: true,
      message: 'Billing cancelled successfully. Test request will not be sent to lab.',
      data: updatedBilling
    });

  } catch (error) {
    console.error('Cancel billing error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling billing',
      error: error.message
    });
  }
};

// @desc    Process refund for billing
// @route   POST /api/billing/:id/refund
// @access  Private (Receptionist, Admin)
export const processRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      refundAmount, 
      refundMethod = 'cash', 
      refundReason = 'Refund requested by user',
      refundReference = `REF-${Date.now()}`
    } = req.body;

    console.log('Processing refund for billing ID:', id);
    console.log('User:', req.user.id, 'Role:', req.user.role);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid billing ID'
      });
    }

    let filter = { _id: id, isActive: true };
    
    // Filter by center for non-superAdmin users
    if (req.user.role !== 'superAdmin') {
      filter.center = req.user.centerId;
    }

    const billing = await Billing.findOne(filter);
    if (!billing) {
      return res.status(404).json({
        success: false,
        message: 'Billing record not found'
      });
    }

    // Validate refund amount
    const refundAmt = refundAmount || billing.paidAmount;
    
    if (refundAmt <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Refund amount must be greater than 0. No payment has been made yet.'
      });
    }

    if (refundAmt > billing.paidAmount) {
      return res.status(400).json({
        success: false,
        message: `Refund amount cannot exceed paid amount (₹${billing.paidAmount})`
      });
    }

    // Check if billing is already refunded
    if (billing.status === 'refunded') {
      return res.status(400).json({
        success: false,
        message: 'Billing has already been refunded'
      });
    }

    // Update billing with refund information
    const updatedBilling = await Billing.findByIdAndUpdate(
      id,
      {
        status: 'refunded',
        paymentStatus: 'refunded',
        updatedBy: req.user.id,
        refundAmount: refundAmt,
        refundMethod,
        refundReason,
        refundReference,
        refundedAt: new Date(),
        refundedBy: req.user.id,
        $push: {
          'workflow.stages': {
            stage: 'billing',
            status: 'cancelled',
            updatedBy: req.user.id,
            notes: `Refunded: ${refundReason} (${refundMethod}, Ref: ${refundReference})`
          }
        }
      },
      { new: true }
    ).populate([
      { path: 'testRequest', select: 'testType status' },
      { path: 'patient', select: 'name email contactNumber' },
      { path: 'doctor', select: 'firstName lastName' },
      { path: 'center', select: 'name centerCode' },
      { path: 'createdBy', select: 'firstName lastName' },
      { path: 'updatedBy', select: 'firstName lastName' }
    ]);

    // Update test request status to prevent it from going to lab
    if (billing.testRequest) {
      await TestRequest.findByIdAndUpdate(billing.testRequest, {
        status: 'Cancelled',
        notes: `Billing refunded: ${refundReason}`
      });
      console.log('Test request updated to Cancelled status due to refund');
    }

    res.status(200).json({
      success: true,
      message: 'Refund processed successfully. Test request will not be sent to lab.',
      data: updatedBilling
    });

  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing refund',
      error: error.message
    });
  }
};
