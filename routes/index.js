// /routes/index.js
import express from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import centerRoutes from './centerRoutes.js';
import patientRoutes from './patientRoutes.js';
import patientHistoryRoutes from './patientHistoryRoutes.js';
import testRequestRoutes from './testRequestRoutes.js';
import labStaffRoutes from './labStaffRoutes.js';
import superConsultantRoutes from './superConsultantRoutes.js';
import superadminRoutes from './superadminRoutes.js';
import billingRoutes from './billingRoutes.js';
import receptionistBillingRoutes from './receptionistBillingRoutes.js';
import comprehensiveBillingRoutes from './comprehensiveBillingRoutes.js';
import testMasterRoutes from './testMasterRoutes.js';
import medicationRoutes from './medicationRoutes.js';
import { authenticateJWT } from '../middleware/authMiddleware.js';


const router = express.Router();

// Test endpoint to verify authentication
router.get('/test-auth', authenticateJWT, (req, res) => {
  res.json({
    success: true,
    message: 'Authentication successful',
    user: {
      id: req.user.id,
      role: req.user.role,
      centerId: req.user.centerId
    }
  });
});

// Mount the routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/centers', centerRoutes);
router.use('/patients', patientRoutes);
router.use('/patient-history', patientHistoryRoutes);
router.use('/test-requests', testRequestRoutes);
router.use('/lab-staff', labStaffRoutes);
router.use('/super-consultant', superConsultantRoutes);
router.use('/superadmin', superadminRoutes);
router.use('/billing', billingRoutes);
router.use('/receptionist-billing', receptionistBillingRoutes);
router.use('/comprehensive-billing', comprehensiveBillingRoutes);
router.use('/test-master', testMasterRoutes);
router.use('/medications', medicationRoutes);




export default router;