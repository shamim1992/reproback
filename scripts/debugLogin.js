import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';
import bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

const debugLogin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find the user
    const user = await User.findOne({ email: 'webdesigner@chanrejournals.com' });
    if (!user) {
      console.log('❌ User not found!');
      process.exit(1);
    }

    console.log('✅ User found:');
    console.log('  Email:', user.email);
    console.log('  Username:', user.username);
    console.log('  Role:', user.role);
    console.log('  Active:', user.isActive);

    // Test password
    const testPassword = 'webdesigner123';
    const isMatch = await bcrypt.compare(testPassword, user.password);
    console.log('✅ Password match:', isMatch);

    if (!isMatch) {
      console.log('❌ Password does not match! Resetting...');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(testPassword, salt);
      user.password = hashedPassword;
      await user.save();
      console.log('✅ Password reset successfully!');
    }

    console.log('\n=== FINAL CREDENTIALS ===');
    console.log('Email: webdesigner@chanrejournals.com');
    console.log('Password: webdesigner123');
    console.log('Role: SuperAdmin');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

debugLogin();

