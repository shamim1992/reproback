import express from 'express';
import { authenticateJWT } from '../middleware/authMiddleware.js';
import { checkRole } from '../middleware/roleMiddleware.js';
import { 
  getSuperAdminDashboardStats,
  getSystemOverview 
} from '../controllers/superadminController.js';

const router = express.Router();

// Super Admin Dashboard Statistics
router.get(
  '/dashboard/stats',
  authenticateJWT,
  checkRole(['superAdmin', 'Admin']),
  getSuperAdminDashboardStats
);

// System Overview
router.get(
  '/system-overview',
  authenticateJWT,
  checkRole(['superAdmin', 'Admin']),
  getSystemOverview
);

export default router;

