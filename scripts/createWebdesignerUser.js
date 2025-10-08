import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';
import bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

const createWebdesignerUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if user already exists
    const existingUser = await User.findOne({ email: 'webdesigner@chanrejournals.com' });
    if (existingUser) {
      console.log('User already exists, updating password...');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('webdesigner123', salt);
      existingUser.password = hashedPassword;
      await existingUser.save();
      console.log('Password updated successfully!');
    } else {
      // Create new user
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('webdesigner123', salt);

      const newUser = new User({
        firstName: 'Web',
        lastName: 'Designer',
        username: 'webdesigner',
        email: 'webdesigner@chanrejournals.com',
        password: hashedPassword,
        role: 'superAdmin',
        phone: '1234567890',
        isActive: true
      });

      await newUser.save();
      console.log('User created successfully!');
    }

    console.log('\n=== LOGIN CREDENTIALS ===');
    console.log('Email: webdesigner@chanrejournals.com');
    console.log('Password: webdesigner123');
    console.log('Role: SuperAdmin');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating user:', error);
    process.exit(1);
  }
};

createWebdesignerUser();

