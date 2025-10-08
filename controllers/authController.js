import User from '../models/userModel.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { jwtConfig } from '../config/jwt.js';
import { sendPasswordResetEmail } from '../config/emailService.js';

// User signup
export const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, username, email, password, role, phone } = req.body;

    const userExists = await User.findOne({ email });
    console.log("Existing user : ", userExists)
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      firstName: firstName || '',
      lastName: lastName || '',
      username,
      email,
      password: hashedPassword,
      role,
      phone: phone || '',
      isActive: true
    });

    const token = jwt.sign({ 
      id: user._id, 
      role: user.role, 
      centerId: user.centerId 
    }, jwtConfig.secret, {
      expiresIn: jwtConfig.expiresIn,
    });

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { 
        id: user._id, 
        firstName: user.firstName, 
        lastName: user.lastName, 
        role: user.role 
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    
    // Check if it's a database connection error
    if (error.name === 'MongoNetworkError' || error.message.includes('ECONNREFUSED')) {
      return res.status(503).json({ 
        message: 'Database connection failed. Please try again later.',
        error: 'Database unavailable'
      });
    }
    
    return res.status(500).json({ 
      message: 'Server error', 
      error: error.message || 'Unknown error'
    });
  }
};

// User login
export const loginUser = async (req, res) => {
  const { email, username, password } = req.body;

  console.log('Login request received:', {
    email,
    username,
    hasPassword: !!password,
    body: req.body
  });

  try {
    // Check if user provided email or username
    if (!email && !username) {
      console.log('No email or username provided');
      return res.status(400).json({ message: 'Email or username is required' });
    }

    // Find user by email or username
    const user = await User.findOne({
      $or: [
        { email: email },
        { username: username }
      ]
    }).populate('centerId', 'name centerCode');

    console.log('User found:', {
      found: !!user,
      id: user?._id,
      email: user?.email,
      username: user?.username,
      role: user?.role,
      centerId: user?.centerId,
      isActive: user?.isActive
    });

    if (!user) {
      console.log('No user found with email/username:', { email, username });
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive) {
      console.log('User account is inactive:', user.email);
      return res.status(400).json({ message: 'Account is inactive. Please contact administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password match:', isMatch);

    if (!isMatch) {
      console.log('Password mismatch for user:', user.email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ 
      id: user._id, 
      role: user.role, 
      centerId: user.centerId 
    }, jwtConfig.secret, {
      expiresIn: jwtConfig.expiresIn,
    });

    return res.status(200).json({
      message: 'Logged in successfully',
      token,
      user,
    });
  } catch (error) {
    console.error('Login error:', error);
    
    // Check if it's a database connection error
    if (error.name === 'MongoNetworkError' || error.message.includes('ECONNREFUSED')) {
      return res.status(503).json({ 
        message: 'Database connection failed. Please try again later.',
        error: 'Database unavailable'
      });
    }
    
    return res.status(500).json({ 
      message: 'Server error', 
      error: error.message || 'Unknown error'
    });
  }
};

// Get user profile
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId)
      .populate('centerId', 'name centerCode')
      .select('-password -resetPasswordToken -resetPasswordExpires');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error('Get user profile error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Forgot password
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // For security, don't reveal if email exists or not
      return res.status(200).json({ 
        message: 'If an account with that email exists, a password reset link has been sent.' 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Save reset token to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();

    // Send email
    try {
      const userName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user.name || 'User';
      await sendPasswordResetEmail(user.email, resetToken, userName);
      
      return res.status(200).json({
        message: 'Password reset link has been sent to your email address.'
      });
    } catch (emailError) {
      // Clear the reset token if email fails
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();
      
      console.error('Email sending failed:', emailError);
      return res.status(500).json({ 
        message: 'Failed to send password reset email. Please try again later.' 
      });
    }

  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Reset password
export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() } // Token hasn't expired
    });

    if (!user) {
      return res.status(400).json({ 
        message: 'Invalid or expired password reset token' 
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update user password and clear reset token
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.status(200).json({
      message: 'Password has been reset successfully. You can now login with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Verify reset token (optional - for frontend validation)
export const verifyResetToken = async (req, res) => {
  const { token } = req.params;

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ 
        message: 'Invalid or expired password reset token',
        valid: false 
      });
    }

    return res.status(200).json({
      message: 'Token is valid',
      valid: true,
      email: user.email // Don't send full email, just partial for confirmation
    });

  } catch (error) {
    console.error('Verify reset token error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Change password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        message: 'Current password and new password are required',
        errors: {
          currentPassword: !currentPassword ? 'Current password is required' : '',
          newPassword: !newPassword ? 'New password is required' : ''
        }
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        message: 'New password must be at least 6 characters long',
        errors: {
          newPassword: 'New password must be at least 6 characters long'
        }
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ 
        message: 'Current password is incorrect',
        errors: {
          currentPassword: 'Current password is incorrect'
        }
      });
    }

    // Check if new password is different from current password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({ 
        message: 'New password must be different from current password',
        errors: {
          newPassword: 'New password must be different from current password'
        }
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedNewPassword;
    await user.save();

    return res.status(200).json({
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};