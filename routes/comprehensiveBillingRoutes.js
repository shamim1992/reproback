import express from 'express';
import mongoose from 'mongoose';
import {
  createComprehensiveBilling,
  generatePreviewInvoice,
  approvePreviewInvoice,
  processComprehensivePayment,
  cancelComprehensiveBilling,
  processComprehensiveRefund,
  getComprehensiveBillingRecords,
  getComprehensiveBillingById,
  updateComprehensiveBilling,
  deleteComprehensiveBilling
} from '../controllers/comprehensiveBillingController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/authMiddleware.js';
import ComprehensiveBilling from '../models/comprehensiveBillingModel.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

// @route   POST /api/comprehensive-billing
// @desc    Create new comprehensive billing record
// @access  Private (Receptionist, Admin)
router.post(
  '/',
  authorizeRoles('Receptionist', 'Admin'),
  createComprehensiveBilling
);

// @route   GET /api/comprehensive-billing
// @desc    Get all comprehensive billing records with pagination and filters
// @access  Private (All authenticated users)
router.get(
  '/',
  authorizeRoles('Receptionist', 'Admin', 'Doctor', 'Accountant', 'superAdmin', 'Super Consultant'),
  getComprehensiveBillingRecords
);

// @route   GET /api/comprehensive-billing/:id
// @desc    Get single comprehensive billing record by ID
// @access  Private (All authenticated users)
router.get(
  '/:id',
  authorizeRoles('Receptionist', 'Admin', 'Doctor', 'Accountant', 'superAdmin', 'Super Consultant'),
  getComprehensiveBillingById
);

// @route   PUT /api/comprehensive-billing/:id
// @desc    Update comprehensive billing record
// @access  Private (Receptionist, Admin)
router.put(
  '/:id',
  authorizeRoles('Receptionist', 'Admin'),
  updateComprehensiveBilling
);

// @route   DELETE /api/comprehensive-billing/:id
// @desc    Delete comprehensive billing record (soft delete)
// @access  Private (Admin, superAdmin only)
router.delete(
  '/:id',
  authorizeRoles('Admin', 'superAdmin'),
  deleteComprehensiveBilling
);

// @route   POST /api/comprehensive-billing/:id/preview
// @desc    Generate preview invoice
// @access  Private (Receptionist, Admin)
router.post(
  '/:id/preview',
  authorizeRoles('Receptionist', 'Admin'),
  generatePreviewInvoice
);

// @route   POST /api/comprehensive-billing/:id/approve
// @desc    Approve preview invoice
// @access  Private (Receptionist, Admin)
router.post(
  '/:id/approve',
  authorizeRoles('Receptionist', 'Admin'),
  approvePreviewInvoice
);

// @route   POST /api/comprehensive-billing/:id/payment
// @desc    Process payment for comprehensive billing
// @access  Private (Receptionist, Admin)
router.post(
  '/:id/payment',
  authorizeRoles('Receptionist', 'Admin'),
  processComprehensivePayment
);

// @route   POST /api/comprehensive-billing/:id/cancel
// @desc    Cancel comprehensive billing
// @access  Private (Receptionist, Admin)
router.post(
  '/:id/cancel',
  authorizeRoles('Receptionist', 'Admin'),
  cancelComprehensiveBilling
);

// @route   POST /api/comprehensive-billing/:id/refund
// @desc    Process refund for comprehensive billing
// @access  Private (Receptionist, Admin)
router.post(
  '/:id/refund',
  authorizeRoles('Receptionist', 'Admin'),
  processComprehensiveRefund
);

// @route   POST /api/comprehensive-billing/:id/mark-viewed
// @desc    Mark consultation as viewed by doctor
// @access  Private (Doctor)
router.post(
  '/:id/mark-viewed',
  authorizeRoles('Doctor', 'Admin', 'superAdmin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { consultationStatus, viewedAt } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid billing ID'
        });
      }

      const billing = await ComprehensiveBilling.findById(id);
      if (!billing) {
        return res.status(404).json({
          success: false,
          message: 'Billing record not found'
        });
      }

      // Update consultation status
      billing.consultationStatus = consultationStatus || 'viewed';
      billing.viewedAt = viewedAt || new Date();
      billing.viewedBy = req.user.id;
      billing.updatedBy = req.user.id;

      await billing.save();

      await billing.populate([
        { path: 'patient', select: 'name email contactNumber gender dateOfBirth age' },
        { path: 'doctor', select: 'firstName lastName department' },
        { path: 'center', select: 'name centerCode address contactNumber email website' },
        { path: 'viewedBy', select: 'firstName lastName' }
      ]);

      res.status(200).json({
        success: true,
        message: 'Consultation marked as viewed',
        data: billing
      });
    } catch (error) {
      console.error('Mark as viewed error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while marking as viewed',
        error: error.message
      });
    }
  }
);

// Additional utility routes

// @route   GET /api/comprehensive-billing/patient/:patientId
// @desc    Get comprehensive billing records by patient ID
// @access  Private (All authenticated users)
router.get(
  '/patient/:patientId',
  authorizeRoles('Receptionist', 'Admin', 'Doctor', 'Accountant', 'superAdmin', 'Super Consultant'),
  async (req, res) => {
    try {
      const { patientId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      if (!mongoose.Types.ObjectId.isValid(patientId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid patient ID'
        });
      }

      let filter = { patient: patientId, isActive: true };
      
      // Filter by center for non-superAdmin users
      if (req.user.role !== 'superAdmin') {
        filter.center = req.user.centerId;
      }

      const billingRecords = await ComprehensiveBilling.find(filter)
        .populate('patient', 'name email contactNumber')
        .populate('doctor', 'firstName lastName')
        .populate('center', 'name centerCode')
        .populate('createdBy', 'firstName lastName')
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
      console.error('Get comprehensive billing by patient error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching comprehensive billing records',
        error: error.message
      });
    }
  }
);

// @route   GET /api/comprehensive-billing/doctor/:doctorId
// @desc    Get comprehensive billing records by doctor ID
// @access  Private (All authenticated users)
router.get(
  '/doctor/:doctorId',
  authorizeRoles('Receptionist', 'Admin', 'Doctor', 'Accountant', 'superAdmin', 'Super Consultant'),
  async (req, res) => {
    try {
      const { doctorId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      if (!mongoose.Types.ObjectId.isValid(doctorId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid doctor ID'
        });
      }

      let filter = { doctor: doctorId, isActive: true };
      
      // Filter by center for non-superAdmin users
      if (req.user.role !== 'superAdmin') {
        filter.center = req.user.centerId;
      }

      const billingRecords = await ComprehensiveBilling.find(filter)
        .populate('patient', 'name email contactNumber')
        .populate('doctor', 'firstName lastName')
        .populate('center', 'name centerCode')
        .populate('createdBy', 'firstName lastName')
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
      console.error('Get comprehensive billing by doctor error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching comprehensive billing records',
        error: error.message
      });
    }
  }
);

// @route   GET /api/comprehensive-billing/pending/payments
// @desc    Get pending payment bills
// @access  Private (Receptionist, Admin, Accountant, superAdmin)
router.get(
  '/pending/payments',
  authorizeRoles('Receptionist', 'Admin', 'Accountant', 'superAdmin', 'Super Consultant'),
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      let filter = { 
        isActive: true,
        paymentStatus: { $in: ['pending', 'partial'] }
      };
      
      // Filter by center for non-superAdmin users
      if (req.user.role !== 'superAdmin') {
        filter.center = req.user.centerId;
      }

      const pendingBills = await ComprehensiveBilling.find(filter)
        .populate('patient', 'name email contactNumber')
        .populate('doctor', 'firstName lastName')
        .populate('center', 'name centerCode')
        .populate('createdBy', 'firstName lastName')
        .populate('paymentHistory.processedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await ComprehensiveBilling.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: pendingBills,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalRecords: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      });

    } catch (error) {
      console.error('Get pending comprehensive payments error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching pending comprehensive payments',
        error: error.message
      });
    }
  }
);

// @route   GET /api/comprehensive-billing/paid/bills
// @desc    Get paid bills (for doctor access)
// @access  Private (Doctor, Admin, superAdmin)
router.get(
  '/paid/bills',
  authorizeRoles('Doctor', 'Admin', 'superAdmin', 'Super Consultant'),
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      let filter = { 
        isActive: true,
        paymentStatus: 'paid',
        status: 'paid'
      };
      
      // Filter by center for non-superAdmin users
      if (req.user.role !== 'superAdmin') {
        filter.center = req.user.centerId;
      }

      // Filter by doctor if user is a doctor
      if (req.user.role === 'Doctor') {
        filter.doctor = req.user.id;
      }

      const paidBills = await ComprehensiveBilling.find(filter)
        .populate('patient', 'name email contactNumber')
        .populate('doctor', 'firstName lastName')
        .populate('center', 'name centerCode')
        .populate('createdBy', 'firstName lastName')
        .populate('paymentHistory.processedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await ComprehensiveBilling.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: paidBills,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalRecords: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      });

    } catch (error) {
      console.error('Get paid comprehensive bills error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching paid comprehensive bills',
        error: error.message
      });
    }
  }
);

export default router;
