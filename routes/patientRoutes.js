// Enhanced patientRoutes.js
import express from 'express';
import { authenticateJWT, authorizeRoles } from '../middleware/authMiddleware.js';
import {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  getPatientsByCenter,
  getPatientsByUser,
  getActivePatients,
  togglePatientStatus,
  getDoctorsByCenter // New function for fetching doctors
} from '../controllers/patientController.js';

const router = express.Router();

// Routes with authentication middleware
// Get all patients (Admin/SuperAdmin only)
router.get('/', authenticateJWT, authorizeRoles('Admin', 'superAdmin'), getAllPatients);

// Get active patients
router.get('/active', authenticateJWT, getActivePatients);

// Get patients by current user's center
router.get('/user/patients', authenticateJWT, getPatientsByUser);

// Get doctors by center (for Receptionist/Admin to assign to patients)
router.get('/doctors/available', authenticateJWT, authorizeRoles('Receptionist', 'Admin', 'superAdmin'), getDoctorsByCenter);

// Get patients by center code
router.get('/center/:centerCode', authenticateJWT, getPatientsByCenter);

// Get patient by ID
router.get('/:id', authenticateJWT, getPatientById);

// Create patient (Admin/SuperAdmin/Doctor/Receptionist)
router.post('/', authenticateJWT, authorizeRoles('Admin', 'superAdmin', 'Doctor', 'Receptionist'), createPatient);

// Update patient (Admin/SuperAdmin/Doctor/Receptionist)
router.put('/:id', authenticateJWT, authorizeRoles('Admin', 'superAdmin', 'Doctor', 'Receptionist'), updatePatient);

// Toggle patient status (Admin/SuperAdmin only)
router.put('/:id/status', authenticateJWT, authorizeRoles('Admin', 'superAdmin'), togglePatientStatus);

// Delete patient (Admin/SuperAdmin only)
router.delete('/:id', authenticateJWT, authorizeRoles('Admin', 'superAdmin'), deletePatient);

export default router;