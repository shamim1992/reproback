// /controllers/patientController.js
import Patient from '../models/patientModel.js';
import Counter from '../models/counterModel.js';


const getNextPatientId = async () => {
  const initialId = 3333000000000001; // Starting ID

  const counter = await Counter.findOneAndUpdate(
    { id: 'patientId' }, // Find the counter with id 'patientId'
    { $inc: { sequenceValue: 1 } }, // Increment the sequence value by 1
    { new: true, upsert: true } // Create the counter if it doesn't exist
  );

  const nextId = initialId + counter.sequenceValue; // Increment from the initial ID
  return nextId;
};

// Create a new patient
export const createPatient = async (req, res) => {
  try {
    // Generate the next patient ID
    const patientId = await getNextPatientId();

    // Create a new patient with the incremented patient ID
    const newPatient = new Patient({
      ...req.body,
      patientId, // Assign the generated patient ID
    });

    const savedPatient = await newPatient.save();
    res.status(201).json(savedPatient);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create patient', error: error.message });
  }
};

// Get all patients
export const getAllPatients = async (req, res) => {
  try {
    const patients = await Patient.find();
    return res.status(200).json(patients);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};

// Get patient by ID
export const getPatientById = async (req, res) => {
  const { patientId } = req.params;

  try {
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    return res.status(200).json({ patient });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};

// Update patient
export const updatePatient = async (req, res) => {
  const { patientId } = req.params;
  const { name, age, gender, contact, medicalHistory } = req.body;

  try {
    const patient = await Patient.findById(patientId);

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    patient.name = name || patient.name;
    patient.age = age || patient.age;
    patient.gender = gender || patient.gender;
    patient.contact = contact || patient.contact;
    patient.medicalHistory = medicalHistory || patient.medicalHistory;

    await patient.save();
    return res.status(200).json({ message: 'Patient updated successfully', patient });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};

// Delete patient
export const deletePatient = async (req, res) => {
  const { patientId } = req.params;
console.log(patientId)
  try {
    const patient = await Patient.findByIdAndDelete(patientId);

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    await patient.remove();
    return res.status(200).json({ message: 'Patient deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};
