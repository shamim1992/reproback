import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';
import bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

const createSimpleUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Create a very simple user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('123456', salt);

    const simpleUser = new User({
      firstName: 'Simple',
      lastName: 'User',
      username: 'simple',
      email: 'simple@simple.com',
      password: hashedPassword,
      role: 'superAdmin',
      phone: '1234567890',
      isActive: true
    });

    await simpleUser.save();
    console.log('Simple user created successfully!');
    console.log('\n=== SIMPLE CREDENTIALS ===');
    console.log('Email: simple@simple.com');
    console.log('Password: 123456');
    console.log('Role: SuperAdmin');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating simple user:', error);
    process.exit(1);
  }
};

createSimpleUser();

