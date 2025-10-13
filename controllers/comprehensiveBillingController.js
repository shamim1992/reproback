import ComprehensiveBilling from '../models/comprehensiveBillingModel.js';
import Patient from '../models/patientModel.js';
import User from '../models/userModel.js';
import mongoose from 'mongoose';

// @desc    Create new comprehensive billing record
// @route   POST /api/comprehensive-billing
// @access  Private (Receptionist, Admin)
export const createComprehensiveBilling = async (req, res) => {
  try {
    const {
      patientId,
      doctorId,
      registrationFee,
      consultationFee,
      serviceCharges = [],
      discount = 0,
      tax = 0,
      notes = ''
    } = req.body;

    console.log('Create comprehensive billing request:', req.body);

    // Validate required fields
    if (!patientId || !doctorId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID and Doctor ID are required'
      });
    }

    // Validate patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Validate doctor exists
    const doctor = await User.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Handle registration fee - support both simple number and object format
    let regFeeData = registrationFee;
    if (typeof registrationFee === 'number') {
      regFeeData = {
        amount: registrationFee,
        patientType: 'OP',
        description: 'Registration',
        isApplicable: registrationFee > 0
      };
    } else if (registrationFee && typeof registrationFee === 'object') {
      if (typeof registrationFee.amount !== 'number' || registrationFee.amount < 0) {
        return res.status(400).json({
          success: false,
          message: 'Registration fee amount must be a non-negative number'
        });
      }
      // Ensure new fields are present, use defaults if not
      regFeeData = {
        amount: registrationFee.amount,
        patientType: registrationFee.patientType || 'OP',
        description: registrationFee.description || 'Registration',
        isApplicable: registrationFee.isApplicable !== undefined ? registrationFee.isApplicable : (registrationFee.amount > 0)
      };
    }

    // Handle consultation fee - support both simple number and object format
    let consFeeData = consultationFee;
    if (typeof consultationFee === 'number') {
      consFeeData = {
        amount: consultationFee,
        consultationType: 'op_general',
        patientType: 'OP',
        description: 'Consultation'
      };
    } else if (consultationFee && typeof consultationFee === 'object') {
      if (typeof consultationFee.amount !== 'number' || consultationFee.amount < 0) {
        return res.status(400).json({
          success: false,
          message: 'Consultation fee amount must be a non-negative number'
        });
      }
      // Ensure new fields are present
      consFeeData = {
        amount: consultationFee.amount,
        consultationType: consultationFee.consultationType || 'op_general',
        patientType: consultationFee.patientType || 'OP',
        description: consultationFee.description || 'Consultation'
      };
    }

    // Validate and format service charges
    const formattedServiceCharges = [];
    if (Array.isArray(serviceCharges)) {
      for (let i = 0; i < serviceCharges.length; i++) {
        const service = serviceCharges[i];
        if (!service.serviceName) {
          return res.status(400).json({
            success: false,
            message: `Service ${i + 1}: serviceName is required`
          });
        }
        
        const amount = service.amount || service.price || 0;
        const quantity = service.quantity || 1;
        const totalAmount = service.totalAmount || service.totalPrice || (amount * quantity);
        
        formattedServiceCharges.push({
          serviceName: service.serviceName,
          serviceCode: service.serviceCode || `SVC${i + 1}`,
          patientType: service.patientType || 'OP',
          amount,
          quantity,
          totalAmount,
          description: service.description || ''
        });
      }
    }

    // Create billing record
    const billingData = {
      patient: patientId,
      doctor: doctorId,
      center: req.user.centerId,
      registrationFee: regFeeData,
      consultationFee: consFeeData,
      serviceCharges: formattedServiceCharges,
      discount,
      tax,
      notes,
      createdBy: req.user.id,
      workflow: {
        currentStage: 'billing',
        stages: [{
          stage: 'billing',
          status: 'in_progress',
          updatedBy: req.user.id,
          notes: 'Comprehensive billing created'
        }]
      }
    };

    const billing = new ComprehensiveBilling(billingData);
    await billing.save();

    // Update patient's doctor assignment and billing status
    // This assigns the doctor to the patient when a consultation bill is created
    const updateData = {
      doctorId: doctorId,
      updatedBy: req.user.id
    };

    // If this is the first bill for the patient, mark them as billed
    if (!patient.hasBeenBilled) {
      updateData.hasBeenBilled = true;
      updateData.firstBillingDate = new Date();
    }

    const updatedPatient = await Patient.findByIdAndUpdate(
      patientId, 
      updateData,
      { new: true }
    ).populate('doctorId', 'firstName lastName');
    
    console.log('✅ Patient doctor assignment and billing status updated:', {
      patientId,
      doctorId,
      patientName: updatedPatient?.name,
      assignedDoctor: updatedPatient?.doctorId ? `${updatedPatient.doctorId.firstName} ${updatedPatient.doctorId.lastName}` : 'Not populated',
      hasBeenBilled: updatedPatient?.hasBeenBilled,
      firstBillingDate: updatedPatient?.firstBillingDate
    });

    // Populate the created billing
    await billing.populate([
      { path: 'patient', select: 'name email contactNumber gender dateOfBirth age uhid' },
      { path: 'doctor', select: 'firstName lastName department' },
      { path: 'center', select: 'name centerCode address contactNumber email website' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Comprehensive billing created successfully',
      data: billing
    });

  } catch (error) {
    console.error('Create comprehensive billing error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    
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
    
    res.status(500).json({
      success: false,
      message: 'Server error while creating comprehensive billing',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Generate preview invoice
// @route   POST /api/comprehensive-billing/:id/preview
// @access  Private (Receptionist, Admin)
export const generatePreviewInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { expiresInHours = 24 } = req.body;

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

    const billing = await ComprehensiveBilling.findOne(filter);
    if (!billing) {
      return res.status(404).json({
        success: false,
        message: 'Billing record not found'
      });
    }

    // Check if billing is in draft status
    if (billing.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Preview can only be generated for draft bills'
      });
    }

    // Generate preview invoice
    const expiresAt = new Date(Date.now() + (expiresInHours * 60 * 60 * 1000));
    
    const updatedBilling = await ComprehensiveBilling.findByIdAndUpdate(
      id,
      {
        status: 'preview',
        previewInvoice: {
          generatedAt: new Date(),
          expiresAt,
          isApproved: false
        },
        'workflow.currentStage': 'preview',
        updatedBy: req.user.id,
        $push: { 
          'workflow.stages': {
            stage: 'preview',
            status: 'in_progress',
            updatedBy: req.user.id,
            notes: 'Preview invoice generated'
          }
        }
      },
      { new: true }
    );

    // Populate the updated billing
    await updatedBilling.populate([
      { path: 'patient', select: 'name email contactNumber gender dateOfBirth age' },
      { path: 'doctor', select: 'firstName lastName department' },
      { path: 'center', select: 'name centerCode address contactNumber email website' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Preview invoice generated successfully',
      data: updatedBilling
    });

  } catch (error) {
    console.error('Generate preview invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating preview invoice',
      error: error.message
    });
  }
};

// @desc    Approve preview invoice
// @route   POST /api/comprehensive-billing/:id/approve
// @access  Private (Receptionist, Admin)
export const approvePreviewInvoice = async (req, res) => {
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

    const billing = await ComprehensiveBilling.findOne(filter);
    if (!billing) {
      return res.status(404).json({
        success: false,
        message: 'Billing record not found'
      });
    }

    // Check if billing is in preview status
    if (billing.status !== 'preview') {
      return res.status(400).json({
        success: false,
        message: 'Only preview invoices can be approved'
      });
    }

    // Check if preview has expired
    if (billing.previewInvoice.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Preview invoice has expired'
      });
    }

    // Approve preview invoice
    const updatedBilling = await ComprehensiveBilling.findByIdAndUpdate(
      id,
      {
        status: 'generated',
        'previewInvoice.isApproved': true,
        'previewInvoice.approvedAt': new Date(),
        'previewInvoice.approvedBy': req.user.id,
        'workflow.currentStage': 'payment',
        updatedBy: req.user.id,
        $push: { 
          'workflow.stages': {
            stage: 'preview',
            status: 'completed',
            updatedBy: req.user.id,
            notes: 'Preview invoice approved by patient'
          }
        }
      },
      { new: true }
    );

    // Populate the updated billing
    await updatedBilling.populate([
      { path: 'patient', select: 'name email contactNumber gender dateOfBirth age' },
      { path: 'doctor', select: 'firstName lastName department' },
      { path: 'center', select: 'name centerCode address contactNumber email website' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Preview invoice approved successfully',
      data: updatedBilling
    });

  } catch (error) {
    console.error('Approve preview invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while approving preview invoice',
      error: error.message
    });
  }
};

// @desc    Process payment for comprehensive billing
// @route   POST /api/comprehensive-billing/:id/payment
// @access  Private (Receptionist, Admin)
export const processComprehensivePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { paidAmount, paymentMethod, notes = '', paymentType = 'full' } = req.body;

    console.log('Processing payment for billing ID:', id);
    console.log('User:', req.user.id, 'Role:', req.user.role, 'Center:', req.user.centerId);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid billing ID'
      });
    }

    // First check if billing exists without center filter
    const billingExists = await ComprehensiveBilling.findOne({ _id: id });
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

    const billing = await ComprehensiveBilling.findOne(filter);
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

    // Check if billing is not cancelled or refunded
    if (billing.status === 'cancelled' || billing.status === 'refunded') {
      return res.status(400).json({
        success: false,
        message: 'Payment cannot be processed for cancelled or refunded bills'
      });
    }

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
      notes: notes || `Payment of ${paidAmount} processed (${paymentType})`,
      receiptNumber
    };

    // Update workflow stage
    let currentStage = billing.workflow.currentStage;
    let newStatus = billing.status;
    
    if (paymentStatus === 'paid') {
      currentStage = 'consultation';
      newStatus = 'paid';
    } else if (paymentStatus === 'partial') {
      currentStage = 'payment';
      newStatus = 'partial';
    }

    // Add workflow stage update
    const workflowUpdate = {
      stage: 'payment',
      status: paymentStatus === 'paid' ? 'completed' : 'in_progress',
      updatedBy: req.user.id,
      notes: notes || `Payment of ${paidAmount} processed (Receipt: ${receiptNumber})`
    };

    const updatedBilling = await ComprehensiveBilling.findByIdAndUpdate(
      id,
      {
        paidAmount: newPaidAmount,
        paymentStatus,
        paymentMethod,
        paymentDate: new Date(),
        status: newStatus,
        updatedBy: req.user.id,
        'workflow.currentStage': currentStage,
        $push: { 
          'workflow.stages': workflowUpdate,
          'paymentHistory': paymentEntry
        }
      },
      { new: true }
    );

    // Populate the updated billing
    await updatedBilling.populate([
      { path: 'patient', select: 'name email contactNumber gender dateOfBirth age' },
      { path: 'doctor', select: 'firstName lastName department' },
      { path: 'center', select: 'name centerCode address contactNumber email website' },
      { path: 'createdBy', select: 'firstName lastName' },
      { path: 'updatedBy', select: 'firstName lastName' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Payment processed successfully',
      data: updatedBilling
    });

  } catch (error) {
    console.error('Process comprehensive payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing payment',
      error: error.message
    });
  }
};

// @desc    Cancel comprehensive billing
// @route   POST /api/comprehensive-billing/:id/cancel
// @access  Private (Receptionist, Admin)
export const cancelComprehensiveBilling = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellationReason, refundAmount = 0 } = req.body;

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

    const billing = await ComprehensiveBilling.findOne(filter);
    if (!billing) {
      return res.status(404).json({
        success: false,
        message: 'Billing record not found'
      });
    }

    // Check if billing can be cancelled
    if (billing.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Billing is already cancelled'
      });
    }

    if (billing.status === 'refunded') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a refunded bill'
      });
    }

    // Validate refund amount
    if (refundAmount < 0 || refundAmount > billing.paidAmount) {
      return res.status(400).json({
        success: false,
        message: 'Refund amount must be between 0 and paid amount'
      });
    }

    // Cancel billing
    const updatedBilling = await ComprehensiveBilling.findByIdAndUpdate(
      id,
      {
        status: 'cancelled',
        paymentStatus: 'cancelled',
        cancellation: {
          isCancelled: true,
          cancelledAt: new Date(),
          cancelledBy: req.user.id,
          cancellationReason: cancellationReason || 'Bill cancelled',
          refundAmount
        },
        'workflow.currentStage': 'cancelled',
        updatedBy: req.user.id,
        $push: { 
          'workflow.stages': {
            stage: 'cancelled',
            status: 'completed',
            updatedBy: req.user.id,
            notes: `Bill cancelled: ${cancellationReason || 'No reason provided'}`
          }
        }
      },
      { new: true }
    );

    // Populate the updated billing
    await updatedBilling.populate([
      { path: 'patient', select: 'name email contactNumber gender dateOfBirth age' },
      { path: 'doctor', select: 'firstName lastName department' },
      { path: 'center', select: 'name centerCode address contactNumber email website' },
      { path: 'createdBy', select: 'firstName lastName' },
      { path: 'updatedBy', select: 'firstName lastName' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Billing cancelled successfully',
      data: updatedBilling
    });

  } catch (error) {
    console.error('Cancel comprehensive billing error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling billing',
      error: error.message
    });
  }
};

// @desc    Process refund for comprehensive billing
// @route   POST /api/comprehensive-billing/:id/refund
// @access  Private (Receptionist, Admin)
export const processComprehensiveRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { refundAmount, refundMethod, refundReason, refundReference } = req.body;

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

    const billing = await ComprehensiveBilling.findOne(filter);
    if (!billing) {
      return res.status(404).json({
        success: false,
        message: 'Billing record not found'
      });
    }

    // Check if billing can be refunded
    if (billing.status === 'refunded') {
      return res.status(400).json({
        success: false,
        message: 'Billing is already refunded'
      });
    }

    if (billing.paidAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No payment to refund'
      });
    }

    // Validate refund amount
    if (refundAmount <= 0 || refundAmount > billing.paidAmount) {
      return res.status(400).json({
        success: false,
        message: 'Refund amount must be between 0 and paid amount'
      });
    }

    // Process refund
    const updatedBilling = await ComprehensiveBilling.findByIdAndUpdate(
      id,
      {
        status: 'refunded',
        paymentStatus: 'refunded',
        refund: {
          isRefunded: true,
          refundedAt: new Date(),
          refundedBy: req.user.id,
          refundAmount,
          refundMethod,
          refundReason: refundReason || 'Refund processed',
          refundReference
        },
        'workflow.currentStage': 'refunded',
        updatedBy: req.user.id,
        $push: { 
          'workflow.stages': {
            stage: 'refunded',
            status: 'completed',
            updatedBy: req.user.id,
            notes: `Refund processed: ${refundAmount} via ${refundMethod}`
          }
        }
      },
      { new: true }
    );

    // Populate the updated billing
    await updatedBilling.populate([
      { path: 'patient', select: 'name email contactNumber gender dateOfBirth age' },
      { path: 'doctor', select: 'firstName lastName department' },
      { path: 'center', select: 'name centerCode address contactNumber email website' },
      { path: 'createdBy', select: 'firstName lastName' },
      { path: 'updatedBy', select: 'firstName lastName' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      data: updatedBilling
    });

  } catch (error) {
    console.error('Process comprehensive refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing refund',
      error: error.message
    });
  }
};

// @desc    Get all comprehensive billing records
// @route   GET /api/comprehensive-billing
// @access  Private
export const getComprehensiveBillingRecords = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    let filter = { isActive: true };
    
    // Filter by center
    if (req.query.center && req.query.center !== 'all') {
      // If center is specified in query, use it (for superAdmin filtering)
      filter.center = req.query.center;
    } else if (req.user.role !== 'superAdmin') {
      // For non-superAdmin users, always filter by their assigned center
      filter.center = req.user.centerId;
    }
    // If superAdmin and no center specified, show all centers

    // Filter by payment status
    if (req.query.paymentStatus) {
      filter.paymentStatus = req.query.paymentStatus;
    }

    // Filter by billing status
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // Filter by patient
    if (req.query.patientId) {
      filter.patient = req.query.patientId;
    }

    // Filter by doctor
    if (req.query.doctorId) {
      filter.doctor = req.query.doctorId;
    }

    // Date range filter
    if (req.query.startDate && req.query.endDate) {
      filter.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    }

    // Search by bill number, patient name, or UHID
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      
      // First, find patients matching the search criteria
      const matchingPatients = await Patient.find({
        $or: [
          { name: searchRegex },
          { uhid: searchRegex }
        ]
      }).select('_id');
      
      const patientIds = matchingPatients.map(p => p._id);
      
      // Search by bill number or matching patient IDs
      filter.$or = [
        { billNumber: searchRegex },
        { patient: { $in: patientIds } }
      ];
    }

    const billingRecords = await ComprehensiveBilling.find(filter)
      .populate('patient', 'name email contactNumber gender dateOfBirth age uhid')
      .populate('doctor', 'firstName lastName department')
      .populate('center', 'name centerCode address contactNumber email website')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ComprehensiveBilling.countDocuments(filter);

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
    console.error('Get comprehensive billing records error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching comprehensive billing records',
      error: error.message
    });
  }
};

// @desc    Get single comprehensive billing record by ID
// @route   GET /api/comprehensive-billing/:id
// @access  Private
export const getComprehensiveBillingById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Getting comprehensive billing by ID:', id);
    console.log('User:', req.user.id, 'Role:', req.user.role, 'Center:', req.user.centerId);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid billing ID'
      });
    }

    // First check if billing exists at all (for debugging)
    const billingExists = await ComprehensiveBilling.findById(id);
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

    const billing = await ComprehensiveBilling.findOne(filter)
      .populate('patient', 'name email contactNumber dateOfBirth gender address uhid')
      .populate('doctor', 'firstName lastName email')
      .populate('center', 'name centerCode address contactNumber')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .populate('paymentHistory.processedBy', 'firstName lastName');

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
        message: 'Comprehensive billing record not found'
      });
    }

    console.log('Billing found successfully');

    res.status(200).json({
      success: true,
      data: billing
    });

  } catch (error) {
    console.error('Get comprehensive billing by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching comprehensive billing record',
      error: error.message
    });
  }
};

// @desc    Update comprehensive billing record
// @route   PUT /api/comprehensive-billing/:id
// @access  Private (Receptionist, Admin)
export const updateComprehensiveBilling = async (req, res) => {
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

    const existingBilling = await ComprehensiveBilling.findOne(filter);
    if (!existingBilling) {
      return res.status(404).json({
        success: false,
        message: 'Comprehensive billing record not found'
      });
    }

    // Check if billing can be updated
    if (existingBilling.status === 'paid' || existingBilling.status === 'cancelled' || existingBilling.status === 'refunded') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update paid, cancelled, or refunded bills'
      });
    }

    // Prepare update data
    const updateData = {
      updatedBy: req.user.id,
      updatedAt: new Date()
    };

    // Update fees if provided
    if (req.body.registrationFee !== undefined) {
      updateData.registrationFee = req.body.registrationFee;
    }
    if (req.body.consultationFee !== undefined) {
      updateData.consultationFee = req.body.consultationFee;
    }
    if (req.body.serviceCharges !== undefined) {
      updateData.serviceCharges = req.body.serviceCharges;
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
    if (req.body.status !== undefined) {
      updateData.status = req.body.status;
    }

    // Recalculate totals
    const regFee = updateData.registrationFee?.amount || existingBilling.registrationFee?.amount || 0;
    const consFee = updateData.consultationFee?.amount || existingBilling.consultationFee?.amount || 0;
    
    let serviceChargesTotal = 0;
    const services = updateData.serviceCharges || existingBilling.serviceCharges || [];
    services.forEach(service => {
      serviceChargesTotal += service.totalAmount || (service.amount * service.quantity) || 0;
    });

    const subtotal = regFee + consFee + serviceChargesTotal;
    const discount = updateData.discount !== undefined ? updateData.discount : existingBilling.discount || 0;
    const tax = updateData.tax !== undefined ? updateData.tax : existingBilling.tax || 0;
    const totalAmount = subtotal - discount + tax;

    updateData.subtotal = subtotal;
    updateData.totalAmount = totalAmount;

    // If no payment has been made yet, update remaining amount
    if (existingBilling.paidAmount === 0) {
      updateData.remainingAmount = totalAmount;
    } else {
      updateData.remainingAmount = totalAmount - existingBilling.paidAmount;
    }

    console.log('Updating billing with data:', updateData);

    const updatedBilling = await ComprehensiveBilling.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('patient', 'name email contactNumber uhid')
      .populate('doctor', 'firstName lastName')
      .populate('center', 'name centerCode')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    res.status(200).json({
      success: true,
      message: 'Comprehensive billing record updated successfully',
      data: updatedBilling
    });

  } catch (error) {
    console.error('Update comprehensive billing error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating comprehensive billing record',
      error: error.message
    });
  }
};

// @desc    Delete comprehensive billing record (soft delete)
// @route   DELETE /api/comprehensive-billing/:id
// @access  Private (Admin, superAdmin only)
export const deleteComprehensiveBilling = async (req, res) => {
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

    const billing = await ComprehensiveBilling.findOne(filter);
    if (!billing) {
      return res.status(404).json({
        success: false,
        message: 'Comprehensive billing record not found'
      });
    }

    // Check if billing can be deleted
    if (billing.status === 'paid' || billing.status === 'cancelled' || billing.status === 'refunded') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete paid, cancelled, or refunded bills'
      });
    }

    // Soft delete
    await ComprehensiveBilling.findByIdAndUpdate(id, {
      isActive: false,
      updatedBy: req.user.id
    });

    res.status(200).json({
      success: true,
      message: 'Comprehensive billing record deleted successfully'
    });

  } catch (error) {
    console.error('Delete comprehensive billing error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting comprehensive billing record',
      error: error.message
    });
  }
};
