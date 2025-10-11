import express from 'express';
import { authenticateJWT } from '../middleware/authMiddleware.js';
import { checkRole } from '../middleware/roleMiddleware.js';
import {
  getPatientMedications,
  getActiveMedications,
  getMedicationById,
  createMedication,
  updateMedication,
  deleteMedication,
  discontinueMedication
} from '../controllers/medicationController.js';

const router = express.Router();

// Get all medications for a patient
router.get(
  '/patient/:patientId',
  authenticateJWT,
  getPatientMedications
);

// Get active medications for a patient
router.get(
  '/patient/:patientId/active',
  authenticateJWT,
  getActiveMedications
);

// Get single medication by ID
router.get(
  '/:id',
  authenticateJWT,
  getMedicationById
);

// Create new medication (Only Doctor and Admin)
router.post(
  '/',
  authenticateJWT,
  checkRole(['Doctor', 'Admin', 'superAdmin']),
  createMedication
);

// Update medication (Only Doctor and Admin)
router.put(
  '/:id',
  authenticateJWT,
  checkRole(['Doctor', 'Admin', 'superAdmin']),
  updateMedication
);

// Discontinue medication (Only Doctor and Admin)
router.put(
  '/:id/discontinue',
  authenticateJWT,
  checkRole(['Doctor', 'Admin', 'superAdmin']),
  discontinueMedication
);

// Delete medication (Only Admin and SuperAdmin)
router.delete(
  '/:id',
  authenticateJWT,
  checkRole(['Admin', 'superAdmin']),
  deleteMedication
);

export default router;

