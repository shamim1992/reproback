// /routes/billingRoutes.js
import express from 'express';

import { authenticateJWT, authorizeRoles } from '../middleware/authMiddleware.js';
import { createBilling, getBillings, getBillingById, updateBillingById } from '../controllers/billingController.js';

const router = express.Router();

// Create a new billing record
router.post('/', authenticateJWT, authorizeRoles('Doctor', 'Receptionist', 'Admin','superAdmin', 'Accountant'), createBilling);

// Get all billing records
router.get('/', authenticateJWT, authorizeRoles('Doctor', 'Receptionist', 'Admin','superAdmin', 'Accountant'), getBillings);

// Get a specific billing record by ID
router.get('/:id', authenticateJWT, authorizeRoles('Doctor', 'Receptionist', 'Admin','superAdmin', 'Accountant'), getBillingById);

// update a billing record
router.put('/:id', authenticateJWT, authorizeRoles('Doctor', 'Receptionist', 'Admin','superAdmin', 'Accountant'), updateBillingById);

export default router;
