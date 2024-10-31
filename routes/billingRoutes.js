// /routes/billingRoutes.js
import express from 'express';

import { authenticateJWT, authorizeRoles } from '../middleware/authMiddleware.js';
import { createBilling, getBillings, getBillingById } from '../controllers/billingController.js';

const router = express.Router();

// Create a new billing record
router.post('/', createBilling);

// Get all billing records
router.get('/', getBillings);

// Get a specific billing record by ID
router.get('/:id', getBillingById);

export default router;
