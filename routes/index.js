// /routes/index.js
import express from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import centerRoutes from './centerRoutes.js';
import patientRoutes from './patientRoutes.js';
import patientHistoryRoutes from './patientHistoryRoutes.js'


const router = express.Router();

// Mount the routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/centers', centerRoutes);
router.use('/patients', patientRoutes);
router.use('/patient-history', patientHistoryRoutes)




export default router;