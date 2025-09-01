import express from 'express';

const router = express.Router();

// Importing the controller functions
// import { createCenter, getAllCenters, getCenterById, updateCenter, deleteCenter } from '../controllers/centerController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/authMiddleware.js';

// Import additional controller functions
import { 
  createCenter, 
  getAllCenters, 
  getCenterById, 
  updateCenter, 
  deleteCenter,
  getCenterByCode,
  getActiveCenters,
  getCentersByUser,
  updateCenterStatus
} from '../controllers/centerController.js';

// Define routes - ADD authenticateJWT middleware to all routes that need authentication
router.post('/', authenticateJWT, authorizeRoles('Admin', 'superAdmin'), createCenter);
router.get('/', authenticateJWT, getAllCenters);
router.get('/active', authenticateJWT, getActiveCenters);
router.get('/user', authenticateJWT, getCentersByUser);
router.get('/code/:centerCode', authenticateJWT, getCenterByCode);
router.get('/:id', authenticateJWT, getCenterById);
router.put('/:id', authenticateJWT, updateCenter);
router.delete('/:id', authenticateJWT, deleteCenter);
router.put('/:id/status', authenticateJWT, authorizeRoles('Admin', 'superAdmin'),updateCenterStatus );

export default router;