// /routes/authRoutes.js
import express from 'express';
import { authenticateJWT } from '../middleware/authMiddleware.js';
import { 
  registerUser, 
  loginUser, 
  getUserProfile, 
  forgotPassword, 
  resetPassword, 
  verifyResetToken,
  changePassword
} from '../controllers/authController.js';

const router = express.Router();

// User registration (Super Admin can create users)
router.post('/register', registerUser);

// User login
router.post('/login', loginUser);

// Get user profile (protected route)
router.get('/profile', authenticateJWT, getUserProfile);

// Forgot password
router.post('/forgot-password', forgotPassword);

// Reset password
router.post('/reset-password', resetPassword);

// Verify reset token
router.get('/verify-reset-token/:token', verifyResetToken);

// Change password (protected route)
router.put('/change-password', authenticateJWT, changePassword);

export default router;