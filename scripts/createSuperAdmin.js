import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';
import bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

const createSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if SuperAdmin already exists
    const existingSuperAdmin = await User.findOne({ role: 'superAdmin' });
    if (existingSuperAdmin) {
      console.log('SuperAdmin already exists:', existingSuperAdmin.email);
      process.exit(0);
    }

    // Create SuperAdmin user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    const superAdmin = new User({
      firstName: 'Super',
      lastName: 'Admin',
      username: 'superadmin',
      email: 'admin@repro.com',
      password: hashedPassword,
      role: 'superAdmin',
      phone: '1234567890',
      isActive: true
    });

    await superAdmin.save();
    console.log('SuperAdmin created successfully!');
    console.log('Email: admin@repro.com');
    console.log('Password: admin123');
    console.log('Username: superadmin');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating SuperAdmin:', error);
    process.exit(1);
  }
};

createSuperAdmin();


