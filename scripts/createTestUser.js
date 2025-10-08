import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';
import bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

const createTestUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Create a simple test user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('test123', salt);

    const testUser = new User({
      firstName: 'Test',
      lastName: 'User',
      username: 'testuser',
      email: 'test@test.com',
      password: hashedPassword,
      role: 'superAdmin',
      phone: '1234567890',
      isActive: true
    });

    await testUser.save();
    console.log('Test user created successfully!');
    console.log('\n=== TEST CREDENTIALS ===');
    console.log('Email: test@test.com');
    console.log('Password: test123');
    console.log('Role: SuperAdmin');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating test user:', error);
    process.exit(1);
  }
};

createTestUser();

