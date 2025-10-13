import Medication from '../models/medicationModel.js';
import Patient from '../models/patientModel.js';

// Get all medications for a patient
export const getPatientMedications = async (req, res) => {
  try {
    const { patientId } = req.params;

    const medications = await Medication.find({ patient: patientId })
      .populate('prescribedBy', 'firstName lastName name email')
      .populate('center', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json(medications);
  } catch (error) {
    console.error('Get patient medications error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get active medications for a patient
export const getActiveMedications = async (req, res) => {
  try {
    const { patientId } = req.params;

    const medications = await Medication.find({ 
      patient: patientId,
      isActive: true 
    })
      .populate('prescribedBy', 'firstName lastName name email')
      .populate('center', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json(medications);
  } catch (error) {
    console.error('Get active medications error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get single medication by ID
export const getMedicationById = async (req, res) => {
  try {
    const { id } = req.params;

    const medication = await Medication.findById(id)
      .populate('patient', 'name uhid email contactNumber')
      .populate('prescribedBy', 'firstName lastName name email')
      .populate('center', 'name');

    if (!medication) {
      return res.status(404).json({ message: 'Medication not found' });
    }

    res.status(200).json(medication);
  } catch (error) {
    console.error('Get medication by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create new medication
export const createMedication = async (req, res) => {
  try {
    const { 
      patientId, 
      medicationName, 
      dosage, 
      frequency, 
      route,
      startDate, 
      endDate, 
      notes 
    } = req.body;

    // Verify patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Create medication
    const medication = new Medication({
      patient: patientId,
      medicationName,
      dosage,
      frequency,
      route: route || 'Oral',
      startDate,
      endDate,
      notes,
      prescribedBy: req.user.id,
      center: req.user.centerId || patient.center
    });

    await medication.save();

    // Populate before sending response
    await medication.populate([
      { path: 'prescribedBy', select: 'firstName lastName name email' },
      { path: 'center', select: 'name' }
    ]);

    res.status(201).json({ 
      message: 'Medication added successfully', 
      medication 
    });
  } catch (error) {
    console.error('Create medication error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update medication
export const updateMedication = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      medicationName, 
      dosage, 
      frequency, 
      route,
      startDate, 
      endDate, 
      isActive,
      notes 
    } = req.body;

    const medication = await Medication.findById(id);
    if (!medication) {
      return res.status(404).json({ message: 'Medication not found' });
    }

    // Update fields
    if (medicationName !== undefined) medication.medicationName = medicationName;
    if (dosage !== undefined) medication.dosage = dosage;
    if (frequency !== undefined) medication.frequency = frequency;
    if (route !== undefined) medication.route = route;
    if (startDate !== undefined) medication.startDate = startDate;
    if (endDate !== undefined) medication.endDate = endDate;
    if (isActive !== undefined) medication.isActive = isActive;
    if (notes !== undefined) medication.notes = notes;

    await medication.save();

    // Populate before sending response
    await medication.populate([
      { path: 'prescribedBy', select: 'firstName lastName name email' },
      { path: 'center', select: 'name' }
    ]);

    res.status(200).json({ 
      message: 'Medication updated successfully', 
      medication 
    });
  } catch (error) {
    console.error('Update medication error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete medication
export const deleteMedication = async (req, res) => {
  try {
    const { id } = req.params;

    const medication = await Medication.findByIdAndDelete(id);
    if (!medication) {
      return res.status(404).json({ message: 'Medication not found' });
    }

    res.status(200).json({ message: 'Medication deleted successfully' });
  } catch (error) {
    console.error('Delete medication error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Discontinue medication (soft delete)
export const discontinueMedication = async (req, res) => {
  try {
    const { id } = req.params;

    const medication = await Medication.findById(id);
    if (!medication) {
      return res.status(404).json({ message: 'Medication not found' });
    }

    medication.isActive = false;
    medication.endDate = new Date();
    await medication.save();

    res.status(200).json({ 
      message: 'Medication discontinued successfully',
      medication 
    });
  } catch (error) {
    console.error('Discontinue medication error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


