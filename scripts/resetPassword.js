import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';
import bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

const resetPassword = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find the SuperAdmin user
    const user = await User.findOne({ email: 'shamimakhtarsheikh@gmail.com' });
    if (!user) {
      console.log('User not found');
      process.exit(1);
    }

    // Set a new password
    const newPassword = 'admin123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update the password
    user.password = hashedPassword;
    await user.save();

    console.log('Password reset successfully!');
    console.log('Email: shamimakhtarsheikh@gmail.com');
    console.log('Username: shamim');
    console.log('New Password: admin123');
    
    process.exit(0);
  } catch (error) {
    console.error('Error resetting password:', error);
    process.exit(1);
  }
};

resetPassword();


