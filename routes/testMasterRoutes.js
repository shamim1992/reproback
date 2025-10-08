import express from 'express';
import {
  getAllTests,
  getTestById,
  getTestByCode,
  createTest,
  updateTest,
  deleteTest,
  hardDeleteTest,
  deleteAllTests,
  bulkImportTests
} from '../controllers/testMasterController.js';
import { authenticateJWT } from '../middleware/authMiddleware.js';
import { checkRole } from '../middleware/roleMiddleware.js';

const router = express.Router();

// Public routes (accessible by authenticated users)
router.get('/', authenticateJWT, getAllTests);
router.get('/:id', authenticateJWT, getTestById);
router.get('/code/:code', authenticateJWT, getTestByCode);

// Admin only routes
router.post('/', authenticateJWT, checkRole(['superAdmin', 'Admin']), createTest);
router.put('/:id', authenticateJWT, checkRole(['superAdmin', 'Admin']), updateTest);
router.delete('/:id', authenticateJWT, checkRole(['superAdmin', 'Admin']), deleteTest);
router.delete('/hard-delete/:id', authenticateJWT, checkRole(['superAdmin', 'Admin']), hardDeleteTest);
router.delete('/delete-all/all', authenticateJWT, checkRole(['superAdmin', 'Admin']), deleteAllTests);
router.post('/bulk-import', authenticateJWT, checkRole(['superAdmin', 'Admin']), bulkImportTests);

export default router;

