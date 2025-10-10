import mongoose from 'mongoose';
import Patient from '../models/patientModel.js';
import dotenv from 'dotenv';

dotenv.config();

const checkPatient = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/reproductive_health');
    console.log('Connected to database');

    const patient = await Patient.findOne({ email: 'patient004@gmail.com' })
      .populate('doctorId', 'firstName lastName email');
    
    if (patient) {
      console.log('Patient found:');
      console.log('  UHID:', patient.uhid);
      console.log('  Name:', patient.name);
      console.log('  Email:', patient.email);
      console.log('  Doctor ID:', patient.doctorId);
      console.log('  Doctor Info:', patient.doctorId ? `${patient.doctorId.firstName} ${patient.doctorId.lastName}` : 'Not assigned');
    } else {
      console.log('Patient not found');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkPatient();

