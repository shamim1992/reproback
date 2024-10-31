// import Patient from '../models/patientModel.js';
// import Counter from '../models/counterModel.js';
// const getNextPatientId = async () => {
//   const initialId = 3333000000000001;
//   const counter = await Counter.findOneAndUpdate(
//     { id: 'patientId' },
//     { $inc: { sequenceValue: 1 } },
//     { new: true, upsert: true }
//   );

//   const nextId = initialId + counter.sequenceValue;
//   return nextId;
// };
// export const createPatient = async (req, res) => {
//   try {
//     const patientId = await getNextPatientId();
//     const newPatient = new Patient({
//       ...req.body,
//       patientId,
//     });
//     const savedPatient = await newPatient.save();
//     res.status(201).json(savedPatient);
//   } catch (error) {
//     console.error('Error creating patient:', error);
//     res.status(500).json({ message: 'Failed to create patient', error: error.message });
//   }
// };

import Patient from '../models/patientModel.js';
import Counter from '../models/counterModel.js';

const getNextPatientId = async () => {
  const initialId = 3333000000000001;
  const counter = await Counter.findOneAndUpdate(
    { id: 'patientId' },
    { $inc: { sequenceValue: 1 } },
    { new: true, upsert: true }
  );

  const nextId = initialId + counter.sequenceValue;
  return nextId;
};

export const createPatient = async (req, res) => {
  try {
    const existingPatient = await Patient.findOne({
      emailId: req.body.emailId,
      mobileNumber: req.body.mobileNumber,
    });

    if (existingPatient) {
      return res.status(409).json({ message: 'User with this email and mobile number already exists' });
    }

    let patientId;

    // Check if registeredPatient is 'true' and set the patientId accordingly
    if (req.body.registeredPatient === true) {
      const counter = await Counter.findOneAndUpdate(
        { id: 'registeredPatientId' },
        { $inc: { sequenceValue: 1 } },
        { new: true, upsert: true }
      );
      // Generate the patientId with prefix and padded number
      patientId = `UNHSR${String(counter.sequenceValue).padStart(6, '0')}`;
    } else {
      patientId = await getNextPatientId();
    }

    

    const newPatient = new Patient({
      ...req.body,
      patientId,
    });

    const savedPatient = await newPatient.save();
    res.status(201).json(savedPatient);
  } catch (error) {
    console.error('Error creating patient:', error);
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

// Patient search
export const searchPatients = async (req, res) => {
  try {
    const { query } = req.query;
    console.log("Received query:", query);  // Debug log
    if (!query) {
      console.log("No query provided");  // Log if query is missing
      return res.json([]);
    }

    console.log("Searching for patients with query:", query);  // Debug log

    const patients = await Patient.find({
      $or: [
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { patientId: { $regex: query, $options: 'i' } },
        { mobileNumber: { $regex: query, $options: 'i' } },
      ],
    }).limit(10);

    console.log("Found patients:", patients);  // Debug log
    res.json(patients);
  } catch (error) {
    console.error('Error searching patients:', error);  // Log detailed error
    res.status(500).json({ message: 'Server error', error });
  }
};