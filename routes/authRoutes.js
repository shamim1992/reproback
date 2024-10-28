// /routes/authRoutes.js
import express from 'express';
import { registerUser, loginUser, getUserProfile } from '../controllers/authController.js';
import { authenticateJWT } from '../middleware/authMiddleware.js';

const router = express.Router();

// User registration (Super Admin can create users)
router.post('/register', registerUser);

// User login
router.post('/login', loginUser);

// Get user profile (protected route)
router.get('/profile', authenticateJWT, getUserProfile);

export default router;
