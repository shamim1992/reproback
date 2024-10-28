import express from 'express';
import {
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
} from '../controllers/departmentController.js';

const router = express.Router();

// Department routes
router.post('/', createDepartment); // Create a new department
router.get('/', getAllDepartments); // Get all departments
router.get('/:id', getDepartmentById); // Get a single department by ID
router.put('/:id', updateDepartment); // Update a department by ID
router.delete('/:id', deleteDepartment); // Delete a department by ID

export default router;
