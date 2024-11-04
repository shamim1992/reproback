import express from 'express';
import {
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
} from '../controllers/departmentController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Department routes
router.post('/',authenticateJWT, authorizeRoles('Doctor', 'Receptionist', 'Admin','superAdmin', 'Accountant'), createDepartment); // Create a new department
router.get('/',authenticateJWT, authorizeRoles('Doctor', 'Receptionist', 'Admin','superAdmin', 'Accountant'), getAllDepartments); // Get all departments
router.get('/:id',authenticateJWT, authorizeRoles('Doctor', 'Receptionist', 'Admin','superAdmin', 'Accountant'), getDepartmentById); // Get a single department by ID
router.put('/:id',authenticateJWT, authorizeRoles('Doctor', 'Receptionist', 'Admin','superAdmin', 'Accountant'), updateDepartment); // Update a department by ID
router.delete('/:id',authenticateJWT, authorizeRoles('Doctor', 'Receptionist', 'Admin','superAdmin', 'Accountant'), deleteDepartment); // Delete a department by ID

export default router;
