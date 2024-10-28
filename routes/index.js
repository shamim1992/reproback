// /routes/index.js
import express from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import patientRoutes from './patientRoutes.js';
import appointmentRoutes from './appointmentRoutes.js';
import billingRoutes from './billingRoutes.js';
import reportRoutes from './reportRoutes.js';
import deparmentRoutes from './departmentRoutes.js';

const router = express.Router();

// Mount the routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/patients', patientRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/bills', billingRoutes);
router.use('/reports', reportRoutes);
router.use('/department', deparmentRoutes );

export default router;
