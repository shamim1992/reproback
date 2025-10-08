import mongoose from 'mongoose';
import TestRequest from '../models/testRequestModel.js';
import Patient from '../models/patientModel.js';
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

const createTestRequest = async () => {
  try {
    await connectDB();

    console.log('\n=== CREATING TEST REQUEST ===');
    
    // Find a doctor user
    const doctor = await User.findOne({ role: 'Doctor' }).populate('centerId');
    if (!doctor) {
      console.log('No doctor found. Creating a doctor user...');
      
      // Find or create a center
      let center = await Center.findOne({});
      if (!center) {
        center = await Center.create({
          name: 'Test Center',
          centerCode: 'TC001',
          address: 'Test Address',
          contactNumber: '1234567890',
          email: 'test@center.com',
          isActive: true
        });
        console.log('Created center:', center.name);
      }
      
      // Create a doctor user
      doctor = await User.create({
        firstName: 'Test',
        lastName: 'Doctor',
        username: 'testdoctor',
        email: 'doctor@test.com',
        password: 'password123',
        role: 'Doctor',
        phone: '1234567890',
        centerId: center._id,
        isActive: true
      });
      console.log('Created doctor:', doctor.firstName, doctor.lastName);
    } else {
      console.log('Found doctor:', doctor.firstName, doctor.lastName);
    }

    // Find a patient
    let patient = await Patient.findOne({});
    if (!patient) {
      patient = await Patient.create({
        name: 'Test Patient',
        email: 'patient@test.com',
        contactNumber: '9876543210',
        address: 'Test Patient Address',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'Male',
        isActive: true
      });
      console.log('Created patient:', patient.name);
    } else {
      console.log('Found patient:', patient.name);
    }

    // Create a test request
    const testRequest = await TestRequest.create({
      doctorId: doctor._id,
      patientId: patient._id,
      testTypes: ['Blood Test', 'Urine Test'],
      priority: 'Normal',
      notes: 'Test request for billing system',
      centerId: doctor.centerId._id,
      status: 'Billing_Pending'
    });

    console.log('\nCreated test request:');
    console.log('  ID:', testRequest._id);
    console.log('  Patient:', patient.name);
    console.log('  Doctor:', doctor.firstName, doctor.lastName);
    console.log('  Center:', doctor.centerId.name);
    console.log('  Test Types:', testRequest.testTypes.join(', '));
    console.log('  Status:', testRequest.status);
    console.log('  Priority:', testRequest.priority);

    // Populate and show the full request
    await testRequest.populate([
      { path: 'patientId', select: 'name email contactNumber' },
      { path: 'doctorId', select: 'firstName lastName email' },
      { path: 'centerId', select: 'name centerCode' }
    ]);

    console.log('\nFull test request details:');
    console.log(JSON.stringify(testRequest, null, 2));

  } catch (error) {
    console.error('Error creating test request:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
};

createTestRequest();

