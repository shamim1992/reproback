// /middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import { jwtConfig } from '../config/jwt.js';

// Middleware to verify JWT token
export const authenticateJWT = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Access denied, no token provided' });
  }
  try {
    const decoded = jwt.verify(token, jwtConfig.secret);
    
    // Fetch full user data from database to ensure we have the latest centerId
    const user = await User.findById(decoded.id).populate('centerId', 'name centerCode');
    if (!user || !user.isActive) {
      return res.status(403).json({ message: 'User not found or inactive' });
    }
    
    // Extract centerId properly - handle both populated and non-populated cases
    let centerId = null;
    if (user.centerId) {
      // If centerId is populated (object), extract the _id
      if (typeof user.centerId === 'object' && user.centerId._id) {
        centerId = user.centerId._id;
      } else {
        // If centerId is already an ObjectId
        centerId = user.centerId;
      }
    }
    
    req.user = {
      id: user._id,
      role: user.role,
      centerId: centerId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName
    };
    
    // Debug: Log the user's centerId for billing operations
    console.log('Auth middleware - User centerId:', req.user.centerId);
    console.log('Auth middleware - User centerId type:', typeof req.user.centerId);
    console.log('Auth middleware - Original user.centerId:', user.centerId);
    console.log('Auth middleware - Extracted centerId:', centerId);
    
    console.log('Authenticated user:', {
      id: req.user.id,
      role: req.user.role,
      centerId: req.user.centerId,
      email: req.user.email
    });
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(403).json({ message: 'Invalid token, access denied' });
  }
};

// Middleware for Role-Based Access Control (RBAC)
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied, insufficient permissions' });
    }
    next();
  };
};



