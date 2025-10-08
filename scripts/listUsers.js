import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';
import Center from '../models/centerModel.js';

// Load environment variables
dotenv.config();

const listUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Get all users
    const users = await User.find({}, 'firstName lastName username email role isActive')
      .populate('centerId', 'name centerCode');
    
    console.log('\n=== EXISTING USERS ===');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.firstName} ${user.lastName}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Active: ${user.isActive}`);
      if (user.centerId) {
        console.log(`   Center: ${user.centerId.name} (${user.centerId.centerCode})`);
      }
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error listing users:', error);
    process.exit(1);
  }
};

listUsers();
