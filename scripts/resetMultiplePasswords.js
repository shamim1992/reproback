import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';
import bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

const resetMultiplePasswords = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const usersToReset = [
      { email: 'shamimakhtarsheikh@gmail.com', password: 'admin123' },
      { email: 'drchandrashekara@chanrericr.com', password: 'admin123' },
      { email: 'receptionist@gmail.com', password: 'receptionist123' },
      { email: 'doctor@gmail.com', password: 'doctor123' },
      { email: 'superconsultant@gmail.com', password: 'consultant123' }
    ];

    for (const userData of usersToReset) {
      const user = await User.findOne({ email: userData.email });
      if (user) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(userData.password, salt);
        user.password = hashedPassword;
        await user.save();
        console.log(`✅ Password reset for ${userData.email}: ${userData.password}`);
      } else {
        console.log(`❌ User not found: ${userData.email}`);
      }
    }
    
    console.log('\n=== LOGIN CREDENTIALS ===');
    console.log('SuperAdmin:');
    console.log('  Email: shamimakhtarsheikh@gmail.com | Password: admin123');
    console.log('  Email: drchandrashekara@chanrericr.com | Password: admin123');
    console.log('\nOther Users:');
    console.log('  Email: receptionist@gmail.com | Password: receptionist123');
    console.log('  Email: doctor@gmail.com | Password: doctor123');
    console.log('  Email: superconsultant@gmail.com | Password: consultant123');
    
    process.exit(0);
  } catch (error) {
    console.error('Error resetting passwords:', error);
    process.exit(1);
  }
};

resetMultiplePasswords();

