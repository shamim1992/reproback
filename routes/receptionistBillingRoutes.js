import express from 'express';
import {
  createReceptionistBilling,
  getReceptionistBillingRecords,
  getReceptionistBillingStats,
  getReceptionistBillingById
} from '../controllers/receptionistBillingController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

// @route   POST /api/receptionist-billing
// @desc    Create new receptionist billing record
// @access  Private (Receptionist only)
router.post(
  '/',
  authorizeRoles('Receptionist'),
  createReceptionistBilling
);

// @route   GET /api/receptionist-billing
// @desc    Get receptionist billing records with pagination and filters
// @access  Private (Receptionist, Admin, superAdmin, Accountant)
router.get(
  '/',
  authorizeRoles('Receptionist', 'Admin', 'superAdmin', 'Accountant'),
  getReceptionistBillingRecords
);

// @route   GET /api/receptionist-billing/stats
// @desc    Get receptionist billing statistics
// @access  Private (Receptionist, Admin, superAdmin, Accountant)
router.get(
  '/stats',
  authorizeRoles('Receptionist', 'Admin', 'superAdmin', 'Accountant'),
  getReceptionistBillingStats
);

// @route   GET /api/receptionist-billing/:id
// @desc    Get single receptionist billing record by ID
// @access  Private (Receptionist, Admin, superAdmin, Accountant)
router.get(
  '/:id',
  authorizeRoles('Receptionist', 'Admin', 'superAdmin', 'Accountant'),
  getReceptionistBillingById
);

export default router;










