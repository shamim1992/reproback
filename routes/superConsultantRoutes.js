import express from 'express';
import {
  getTestRequestsForReview,
  getTestRequestForReview,
  submitSuperConsultantReview,
  getSuperConsultantDashboardStats,
  getTestRequestsByReviewStatus,
  getPatientDetails,
  getPatientMedicalHistory,
  getPatientTestRequests
} from '../controllers/superConsultantController.js';
import { authenticateJWT } from '../middleware/authMiddleware.js';
import { checkRole } from '../middleware/roleMiddleware.js';

const router = express.Router();

// All routes require authentication and Super Consultant role
router.use(authenticateJWT);
router.use(checkRole(['Super Consultant']));

// Get all test requests with lab reports for review
router.get('/test-requests', getTestRequestsForReview);

// Get test requests by review status
router.get('/test-requests/status/:status', getTestRequestsByReviewStatus);

// Get specific test request for review
router.get('/test-requests/:id', getTestRequestForReview);

// Submit super consultant review
router.post('/test-requests/:id/review', submitSuperConsultantReview);

// Get dashboard statistics
router.get('/dashboard/stats', getSuperConsultantDashboardStats);

// Patient-related endpoints
router.get('/patients/:id', getPatientDetails);
router.get('/patients/:id/history', getPatientMedicalHistory);
router.get('/patients/:id/test-requests', getPatientTestRequests);

export default router;
