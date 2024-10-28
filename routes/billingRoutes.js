// /routes/billingRoutes.js
import express from 'express';
import { createBill, getAllBills, getBillById, updateBillStatus } from '../controllers/billingController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Create a new bill (Accountant, Admin)
router.post('/', authenticateJWT, authorizeRoles('Accountant', 'Admin'), createBill);

// Get all bills (Accountant, Admin)
router.get('/', authenticateJWT, authorizeRoles('Accountant', 'Admin'), getAllBills);

// Get a bill by ID (Accountant, Admin)
router.get('/:billId', authenticateJWT, authorizeRoles('Accountant', 'Admin'), getBillById);

// Update bill status (Accountant, Admin)
router.put('/:billId/status', authenticateJWT, authorizeRoles('Accountant', 'Admin'), updateBillStatus);

export default router;
