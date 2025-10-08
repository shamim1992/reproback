import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';
import bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

const resetAllPasswords = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users to update`);

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('123456', salt);

    // Update all users
    let updatedCount = 0;
    for (const user of users) {
      user.password = hashedPassword;
      await user.save();
      updatedCount++;
      console.log(`✅ Updated password for: ${user.email}`);
    }

    console.log(`\n🎉 Successfully updated ${updatedCount} user passwords!`);
    console.log('\n=== ALL USER CREDENTIALS ===');
    console.log('Password for ALL users: 123456');
    console.log('\nAvailable users:');
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.firstName} ${user.lastName}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Role: ${user.role}`);
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error resetting passwords:', error);
    process.exit(1);
  }
};

resetAllPasswords();

