import express from 'express';
import {
  getAllLabStaff,
  getLabStaffById,
  createLabStaff,
  updateLabStaff,
  deleteLabStaff,
  getLabStaffByCenterId,
  getLabStaffStats
} from '../controllers/labStaffController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

// Get all lab staff
router.get('/', getAllLabStaff);

// Get lab staff statistics
router.get('/stats', getLabStaffStats);

// Get lab staff by center ID
router.get('/center/:centerId', getLabStaffByCenterId);

// Get lab staff by ID
router.get('/:id', getLabStaffById);

// Create new lab staff (superadmin and lab manager only)
router.post('/', authorizeRoles('superAdmin', 'Lab Manager'), createLabStaff);

// Update lab staff (superadmin and lab manager only)
router.put('/:id', authorizeRoles('superAdmin', 'Lab Manager'), updateLabStaff);

// Delete lab staff (superadmin and lab manager only)
router.delete('/:id', authorizeRoles('superAdmin', 'Lab Manager'), deleteLabStaff);

export default router;
