import express from 'express';
import { createAppointment, deleteAppointment, getAppointmentById, getAppointments, getAppointmentsByPatientId, updateAppointment, updateAppointmentStatus } from '../controllers/appointmentController.js';

const router = express.Router();

router.post('/', createAppointment);
router.get('/', getAppointments);
router.put('/:id', updateAppointment); // Update an appointment by ID
router.delete('/:id', deleteAppointment); // Delete an appointment by ID
router.patch('/:id/status', updateAppointmentStatus); 
router.get('/:id', getAppointmentById);

router.get('/patient/:patientId', getAppointmentsByPatientId);

export default router;

