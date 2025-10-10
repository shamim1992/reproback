import express from 'express';
import mongoose from 'mongoose';
import {
  createBilling,
  getBillingRecords,
  getBillingById,
  updateBilling,
  processPayment,
  updateWorkflowStage,
  getBillingStats,
  deleteBilling,
  getBillingAnalytics,
  getBillingReports,
  cancelBilling,
  processRefund
} from '../controllers/billingController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/authMiddleware.js';
import Billing from '../models/billingModel.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

// @route   POST /api/billing
// @desc    Create new billing record
// @access  Private (Receptionist only)
router.post(
  '/',
  authorizeRoles('Receptionist'),
  createBilling
);

// @route   GET /api/billing
// @desc    Get all billing records with pagination and filters
// @access  Private (All authenticated users)
router.get(
  '/',
  authorizeRoles('Receptionist', 'Admin', 'Doctor', 'Accountant', 'superAdmin'),
  getBillingRecords
);

// @route   GET /api/billing/analytics
// @desc    Get billing analytics and statistics
// @access  Private (Admin, Accountant, superAdmin, Super Consultant)
router.get(
  '/analytics',
  authorizeRoles('Admin', 'Accountant', 'superAdmin', 'Super Consultant'),
  getBillingAnalytics
);

// @route   GET /api/billing/reports
// @desc    Get billing reports with filters
// @access  Private (Admin, Accountant, superAdmin, Super Consultant)
router.get(
  '/reports',
  authorizeRoles('Admin', 'Accountant', 'superAdmin', 'Super Consultant'),
  getBillingReports
);

// @route   GET /api/billing/stats/summary
// @desc    Get billing statistics
// @access  Private (Receptionist, Admin, Accountant, superAdmin)
router.get(
  '/stats/summary',
  authorizeRoles('Receptionist', 'Admin', 'Accountant', 'superAdmin'),
  getBillingStats
);

// @route   GET /api/billing/:id
// @desc    Get single billing record by ID
// @access  Private (All authenticated users)
router.get(
  '/:id',
  authorizeRoles('Receptionist', 'Admin', 'Doctor', 'Accountant', 'superAdmin'),
  getBillingById
);

// @route   PUT /api/billing/:id
// @desc    Update billing record
// @access  Private (Receptionist, Admin)
router.put(
  '/:id',
  authorizeRoles('Receptionist', 'Admin'),
  updateBilling
);

// @route   POST /api/billing/:id/payment
// @desc    Process payment for billing
// @access  Private (Receptionist only)
router.post(
  '/:id/payment',
  authorizeRoles('Receptionist'),
  processPayment
);

// @route   POST /api/billing/:id/cancel
// @desc    Cancel billing record
// @access  Private (Receptionist, Admin, superAdmin)
router.post(
  '/:id/cancel',
  authorizeRoles('Receptionist', 'Admin', 'superAdmin'),
  cancelBilling
);

// @route   POST /api/billing/:id/refund
// @desc    Process refund for billing
// @access  Private (Receptionist, Admin, superAdmin)
router.post(
  '/:id/refund',
  authorizeRoles('Receptionist', 'Admin', 'superAdmin'),
  processRefund
);

// @route   PUT /api/billing/:id/workflow
// @desc    Update workflow stage
// @access  Private (Admin, Doctor, Lab Staff, superAdmin)
router.put(
  '/:id/workflow',
  authorizeRoles('Admin', 'Doctor', 'Lab Manager', 'Lab Technician', 'Lab Assistant', 'Lab Director', 'superAdmin'),
  updateWorkflowStage
);

// @route   DELETE /api/billing/:id
// @desc    Delete billing record (soft delete)
// @access  Private (Receptionist only)
router.delete(
  '/:id',
  authorizeRoles('Receptionist'),
  deleteBilling
);

// Additional utility routes

// @route   GET /api/billing/test-request/:testRequestId
// @desc    Get billing record by test request ID
// @access  Private (All authenticated users)
router.get(
  '/test-request/:testRequestId',
  authorizeRoles('Receptionist', 'Admin', 'Doctor', 'Accountant', 'superAdmin'),
  async (req, res) => {
    try {
      const { testRequestId } = req.params;
      
      if (!mongoose.Types.ObjectId.isValid(testRequestId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid test request ID'
        });
      }

      let filter = { testRequest: testRequestId, isActive: true };
      
      // Filter by center for non-superAdmin users
      if (req.user.role !== 'superAdmin') {
        filter.center = req.user.centerId;
      }

      const billing = await Billing.findOne(filter)
        .populate('testRequest', 'testType status notes')
        .populate('patient', 'name email contactNumber')
        .populate('doctor', 'firstName lastName')
        .populate('center', 'name centerCode')
        .populate('createdBy', 'firstName lastName')
        .populate('updatedBy', 'firstName lastName');

      if (!billing) {
        return res.status(404).json({
          success: false,
          message: 'No billing record found for this test request'
        });
      }

      res.status(200).json({
        success: true,
        data: billing
      });

    } catch (error) {
      console.error('Get billing by test request error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching billing record',
        error: error.message
      });
    }
  }
);

// @route   GET /api/billing/patient/:patientId
// @desc    Get billing records by patient ID
// @access  Private (All authenticated users)
router.get(
  '/patient/:patientId',
  authorizeRoles('Receptionist', 'Admin', 'Doctor', 'Accountant', 'superAdmin'),
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

      const billingRecords = await Billing.find(filter)
        .populate('testRequest', 'testType status')
        .populate('patient', 'name email contactNumber')
        .populate('doctor', 'firstName lastName')
        .populate('center', 'name centerCode')
        .populate('createdBy', 'firstName lastName')
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
      console.error('Get billing by patient error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching billing records',
        error: error.message
      });
    }
  }
);

// @route   GET /api/billing/pending/payments
// @desc    Get pending payment bills
// @access  Private (Receptionist, Admin, Accountant, superAdmin)
router.get(
  '/pending/payments',
  authorizeRoles('Receptionist', 'Admin', 'Accountant', 'superAdmin'),
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

      const pendingBills = await Billing.find(filter)
        .populate('testRequest', 'testType status')
        .populate('patient', 'name email contactNumber')
        .populate('doctor', 'firstName lastName')
        .populate('center', 'name centerCode')
        .populate('createdBy', 'firstName lastName')
        .populate('paymentHistory.processedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Billing.countDocuments(filter);

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
      console.error('Get pending payments error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching pending payments',
        error: error.message
      });
    }
  }
);

// @route   GET /api/billing/partial/payments
// @desc    Get partially paid bills only
// @access  Private (Receptionist, Admin, Accountant, superAdmin)
router.get(
  '/partial/payments',
  authorizeRoles('Receptionist', 'Admin', 'Accountant', 'superAdmin'),
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      let filter = { 
        isActive: true,
        paymentStatus: 'partial'
      };
      
      // Filter by center for non-superAdmin users
      if (req.user.role !== 'superAdmin') {
        filter.center = req.user.centerId;
      }

      const partialBills = await Billing.find(filter)
        .populate('testRequest', 'testType status')
        .populate('patient', 'name email contactNumber')
        .populate('doctor', 'firstName lastName')
        .populate('center', 'name centerCode')
        .populate('createdBy', 'firstName lastName')
        .populate('paymentHistory.processedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Billing.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: partialBills,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalRecords: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      });

    } catch (error) {
      console.error('Get partial payments error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching partial payments',
        error: error.message
      });
    }
  }
);

export default router;
