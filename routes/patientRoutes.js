// /routes/patientRoutes.js
import express from 'express';
import {
  createPatient,
  getAllPatients,
  getPatientById,
  updatePatient,
  deletePatient,
  searchPatients,
} from '../controllers/patientController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Create a new patient (Receptionist, Admin)
router.post('/', authenticateJWT, authorizeRoles('Receptionist', 'Admin', 'superAdmin'), createPatient);

// Get all patients (Doctors, Receptionist, Admin)
router.get('/', authenticateJWT, authorizeRoles('Doctor', 'Receptionist', 'Admin','superAdmin'), getAllPatients);

// Get a patient by ID (Doctors, Receptionist, Admin)
router.get('/:patientId', authenticateJWT, authorizeRoles('Doctor', 'Receptionist', 'Admin','superAdmin'), getPatientById);

// Update a patient (Receptionist, Admin)
router.put('/:patientId', authenticateJWT, authorizeRoles('Receptionist', 'Admin','superAdmin'), updatePatient);

// Delete a patient (Admin)
router.delete('/:patientId', authenticateJWT, authorizeRoles('Admin','superAdmin'), deletePatient);

router.get('/search', authenticateJWT, authorizeRoles('Doctor', 'Receptionist', 'Admin', 'superAdmin'), searchPatients);

export default router;
