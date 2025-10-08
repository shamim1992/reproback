import express from 'express';
import multer from 'multer';
import path from 'path';
import {
  getTestRequestsByDoctor,
  createTestRequest,
  updateTestRequest,
  deleteTestRequest,
  updateTestRequestStatus,
  uploadLabReport,
  downloadLabReport,
  getTestRequestById,
  getTestRequestsForLabStaff,
  getDashboardStats,
  getTestRequestsForBilling,
  fixPendingTestRequests,
  scheduleSampleCollection,
  startTesting,
  completeTesting,
  sendLabReport
} from '../controllers/testRequestController.js';
import { authenticateJWT } from '../middleware/authMiddleware.js';
import { checkRole } from '../middleware/roleMiddleware.js';
import { checkBillingCompleted, checkBillingCompletedOrAdmin } from '../middleware/billingMiddleware.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/lab-reports/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `lab-report-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Get test requests by doctor (for doctors to view their requests)
router.get('/doctor/:doctorId', authenticateJWT, getTestRequestsByDoctor);

// Get all test requests (for lab staff and admins) - use getTestRequestsForLabStaff to ensure proper filtering
router.get('/', authenticateJWT, checkRole(['Lab Manager', 'Lab Technician', 'Lab Assistant', 'Lab Director', 'Quality Control', 'superAdmin', 'Admin']), getTestRequestsForLabStaff);

// Get test requests for lab staff and admins (formatted for frontend) - MUST be before /:id route
router.get('/lab-staff', authenticateJWT, checkRole(['Lab Manager', 'Lab Technician', 'Lab Assistant', 'Lab Director', 'Quality Control', 'superAdmin', 'Admin']), getTestRequestsForLabStaff);

// Get dashboard statistics - MUST be before /:id route
router.get('/dashboard/stats', authenticateJWT, checkRole(['Lab Manager', 'Lab Technician', 'Lab Assistant', 'Lab Director', 'Quality Control', 'superAdmin', 'Admin']), getDashboardStats);

// Get test requests that need billing (for receptionists/admins) - MUST be before /:id route
router.get('/pending-billing', authenticateJWT, checkRole(['Receptionist', 'Admin', 'superAdmin']), getTestRequestsForBilling);

// Fix pending test requests (one-time migration) - MUST be before /:id route
router.post('/fix-pending', authenticateJWT, checkRole(['superAdmin']), fixPendingTestRequests);

// Get test request by ID (must be last to avoid conflicts with specific routes)
router.get('/:id', authenticateJWT, getTestRequestById);

// Create test request (doctors only)
router.post('/', authenticateJWT, checkRole(['Doctor', 'superAdmin']), createTestRequest);

// Update test request
router.put('/:id', authenticateJWT, updateTestRequest);

// Delete test request
router.delete('/:id', authenticateJWT, deleteTestRequest);

// Update test request status (lab staff) - requires billing completion
router.put('/:id/status', authenticateJWT, checkRole(['Lab Manager', 'Lab Technician', 'Lab Assistant', 'Lab Director', 'Quality Control', 'superAdmin']), checkBillingCompleted, updateTestRequestStatus);

// Schedule sample collection (lab staff) - requires billing completion
router.put('/:id/schedule-collection', authenticateJWT, checkRole(['Lab Manager', 'Lab Technician', 'Lab Assistant', 'Lab Director', 'Quality Control', 'superAdmin']), checkBillingCompleted, scheduleSampleCollection);

// Start testing (lab staff) - requires billing completion
router.put('/:id/start-testing', authenticateJWT, checkRole(['Lab Manager', 'Lab Technician', 'Lab Assistant', 'Lab Director', 'Quality Control', 'superAdmin']), checkBillingCompleted, startTesting);

// Complete testing (lab staff) - requires billing completion
router.put('/:id/complete-testing', authenticateJWT, checkRole(['Lab Manager', 'Lab Technician', 'Lab Assistant', 'Lab Director', 'Quality Control', 'superAdmin']), checkBillingCompleted, completeTesting);

// Upload lab report (lab staff) - requires billing completion
router.post('/:id/report', authenticateJWT, checkRole(['Lab Manager', 'Lab Technician', 'Lab Assistant', 'Lab Director', 'Quality Control', 'superAdmin']), checkBillingCompleted, upload.single('report'), uploadLabReport);

// Download lab report - allow admins to bypass billing check
router.get('/:id/report/download', authenticateJWT, checkBillingCompletedOrAdmin, downloadLabReport);

// Send lab report (lab staff) - requires billing completion
router.put('/:id/send-report', authenticateJWT, checkRole(['Lab Manager', 'Lab Technician', 'Lab Assistant', 'Lab Director', 'Quality Control', 'superAdmin']), checkBillingCompleted, sendLabReport);

export default router;