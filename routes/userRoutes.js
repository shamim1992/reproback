import express from 'express';
import { authenticateJWT, authorizeRoles } from '../middleware/authMiddleware.js';
import {
  getAllUsers,
  getUsersByCenter,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  updateUserRole,
  getUsersByCurrentUserCenter
} from '../controllers/userController.js';

const router = express.Router();

// Routes with authentication middleware
router.get('/', authenticateJWT, authorizeRoles('Admin', 'superAdmin'), getAllUsers);
router.get('/center/:centerId', authenticateJWT, getUsersByCenter);
router.get('/my-center', authenticateJWT, getUsersByCurrentUserCenter);
router.get('/:id', authenticateJWT, getUserById);
router.post('/', authenticateJWT, authorizeRoles('Admin', 'superAdmin'), createUser);
router.put('/:id', authenticateJWT, authorizeRoles('Admin', 'superAdmin'), updateUser);
router.delete('/:id', authenticateJWT, authorizeRoles('Admin', 'superAdmin'), deleteUser);
router.put('/:id/status', authenticateJWT, authorizeRoles('Admin', 'superAdmin'), toggleUserStatus);
router.put('/:id/role', authenticateJWT, authorizeRoles('Admin', 'superAdmin'), updateUserRole);

export default router;

