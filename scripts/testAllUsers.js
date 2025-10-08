import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';
import bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

const testAllUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Get all users
    const users = await User.find({}, 'firstName lastName username email role isActive');
    
    console.log('\n=== ALL USERS IN DATABASE ===');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.firstName} ${user.lastName}`);
      console.log(`   Email: "${user.email}"`);
      console.log(`   Username: "${user.username}"`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Active: ${user.isActive}`);
      console.log('');
    });

    // Test specific users
    const testUsers = [
      'test@test.com',
      'webdesigner@chanrejournals.com',
      'shamimakhtarsheikh@gmail.com'
    ];

    console.log('\n=== TESTING SPECIFIC USERS ===');
    for (const email of testUsers) {
      const user = await User.findOne({ email });
      if (user) {
        console.log(`✅ Found: ${email}`);
        console.log(`   Username: "${user.username}"`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Active: ${user.isActive}`);
      } else {
        console.log(`❌ Not found: ${email}`);
      }
      console.log('');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

testAllUsers();

