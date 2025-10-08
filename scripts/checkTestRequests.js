import mongoose from 'mongoose';
import TestRequest from '../models/testRequestModel.js';
import User from '../models/userModel.js';
import Center from '../models/centerModel.js';

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/reproback', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const checkTestRequests = async () => {
  try {
    await connectDB();

    console.log('\n=== CHECKING TEST REQUESTS ===');
    
    // Get all test requests
    const allRequests = await TestRequest.find({})
      .populate('patientId', 'name email contactNumber')
      .populate('doctorId', 'firstName lastName email')
      .populate('centerId', 'name centerCode')
      .sort({ createdAt: -1 });

    console.log(`Total test requests: ${allRequests.length}`);

    // Group by status
    const statusCounts = {};
    allRequests.forEach(request => {
      statusCounts[request.status] = (statusCounts[request.status] || 0) + 1;
    });

    console.log('\nStatus breakdown:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

    // Show pending billing requests
    const pendingBillingRequests = allRequests.filter(req => 
      req.status === 'Billing_Pending' || req.status === 'Pending'
    );

    console.log(`\nPending billing requests: ${pendingBillingRequests.length}`);
    
    if (pendingBillingRequests.length > 0) {
      console.log('\nPending billing requests details:');
      pendingBillingRequests.forEach((request, index) => {
        console.log(`\n${index + 1}. Request ID: ${request._id}`);
        console.log(`   Patient: ${request.patientId?.name || 'N/A'}`);
        console.log(`   Doctor: ${request.doctorId?.firstName} ${request.doctorId?.lastName}`);
        console.log(`   Center: ${request.centerId?.name || 'N/A'}`);
        console.log(`   Status: ${request.status}`);
        console.log(`   Test Types: ${Array.isArray(request.testTypes) ? request.testTypes.join(', ') : request.testTypes}`);
        console.log(`   Created: ${request.createdAt}`);
      });
    }

    // Check users and centers
    console.log('\n=== CHECKING USERS AND CENTERS ===');
    const users = await User.find({}).populate('centerId', 'name centerCode');
    console.log(`Total users: ${users.length}`);
    
    const centers = await Center.find({});
    console.log(`Total centers: ${centers.length}`);

    // Show users with their centers
    console.log('\nUsers and their centers:');
    users.forEach(user => {
      console.log(`  ${user.firstName} ${user.lastName} (${user.role}) - Center: ${user.centerId?.name || 'No Center'}`);
    });

  } catch (error) {
    console.error('Error checking test requests:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
};

checkTestRequests();

