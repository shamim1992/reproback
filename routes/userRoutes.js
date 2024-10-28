// /routes/userRoutes.js
import express from 'express';
// import { getAllUsers, updateUser, deleteUser } from '../controllers/userController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/authMiddleware.js';
import {
    createUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser, getDoctorById, getDoctorsByDepartment,
    getDoctors
  } from '../controllers/userController.js';
const router = express.Router();


router.get('/doctors/department/:departmentId', authenticateJWT, authorizeRoles('superAdmin'), getDoctorsByDepartment);

// Get doctor by ID
router.get('/doctors/:id', authenticateJWT, authorizeRoles('superAdmin'), getDoctorById);
router.get('/doctors', authenticateJWT, authorizeRoles('superAdmin'), getDoctors);

router.post('/',authenticateJWT, authorizeRoles('superAdmin'), createUser);
// Get all users (Super Admin)
router.get('/', authenticateJWT, authorizeRoles('superAdmin'), getAllUsers);

// Get a single user by ID (Super Admin)
router.get('/:id',authenticateJWT, authorizeRoles('superAdmin'), getUserById);
// Update a user (Super Admin)
router.put('/:userId', authenticateJWT, authorizeRoles('superAdmin'), updateUser);

// Delete a user (Super Admin)
router.delete('/:userId', authenticateJWT, authorizeRoles('superAdmin'), deleteUser);

export default router;
