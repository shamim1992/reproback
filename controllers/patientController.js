import User from "../models/userModel.js";
import Center from "../models/centerModel.js";
import Patient from "../models/patientModel.js";


export const createPatient = async (req, res) => {
  try {
    const { 
      name, 
      dateOfBirth, 
      gender, 
      occupation, 
      spouseName, 
      spouseOccupation, 
      spouseDateOfBirth, 
      address, 
      contactNumber, 
      email,
      doctorId // This will be provided by receptionist, ignored if user is doctor
    } = req.body;

    // Get the current user who is creating the patient
    const currentUser = await User.findById(req.user.id).populate('center');
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Always use the current user's assigned center
    if (!currentUser.center) {
      return res.status(400).json({ 
        message: 'Your account is not assigned to any center. Please contact your administrator.' 
      });
    }
    
    const center = currentUser.center;

    // Check if patient with same email already exists
    const existingPatient = await Patient.findOne({ email: email.toLowerCase() });
    if (existingPatient) {
      return res.status(400).json({ message: 'Patient with this email already exists' });
    }

    // Doctor assignment logic based on user role
    let assignedDoctorId = null;

    if (currentUser.role === 'Doctor') {
      // If doctor is creating patient, auto-assign themselves
      assignedDoctorId = currentUser._id;
    } else if (currentUser.role === 'Receptionist' || currentUser.role === 'Admin') {
      // If receptionist/admin is creating patient, use provided doctorId
      if (doctorId) {
        // Validate that the doctor exists and belongs to the same center
        const doctor = await User.findOne({ 
          _id: doctorId, 
          role: 'Doctor', 
          center: center._id,
          isActive: true 
        });
        
        if (!doctor) {
          return res.status(400).json({ 
            message: 'Invalid doctor selected or doctor not available in your center' 
          });
        }
        
        assignedDoctorId = doctorId;
      }
      // Note: doctorId is optional for receptionist/admin - they can create without assigning
    } else {
      // Other roles (if any) cannot assign doctors
      if (doctorId) {
        return res.status(403).json({ 
          message: 'You do not have permission to assign doctors to patients' 
        });
      }
    }

    // Create the patient
    const patient = new Patient({
      name: name.trim(),
      dateOfBirth,
      gender,
      occupation: occupation.trim(),
      spouseName: spouseName.trim(),
      spouseOccupation: spouseOccupation.trim(),
      spouseDateOfBirth,
      address: address.trim(),
      contactNumber: contactNumber.trim(),
      email: email.toLowerCase().trim(),
      doctorId: assignedDoctorId, // Will be null if no doctor assigned
      center: center._id,
      createdBy: currentUser._id
    });

    const savedPatient = await patient.save();
    
    // Populate the saved patient before returning
    await savedPatient.populate('center', 'name address contactNumber centerCode');
    await savedPatient.populate('createdBy', 'name email');
    await savedPatient.populate('doctorId', 'name email'); // Populate doctor info
    
    res.status(201).json(savedPatient);
  } catch (error) {
    console.error('Error creating patient:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ message: errors.join(', ') });
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({ message: `Patient with this ${field} already exists` });
    }
    
    res.status(500).json({ message: 'Failed to create patient' });
  }
};

// Helper function to get available doctors for a center
export const getDoctorsByCenter = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id).populate('center');
    
    if (!currentUser || !currentUser.center) {
      return res.status(400).json({ 
        message: 'User must be assigned to a center' 
      });
    }

    // Only allow Receptionist and Admin to fetch doctors list
    if (!['Receptionist', 'Admin', 'superAdmin'].includes(currentUser.role)) {
      return res.status(403).json({ 
        message: 'You do not have permission to view doctors list' 
      });
    }

    const doctors = await User.find({
      role: 'Doctor',
      center: currentUser.center._id,
      isActive: true
    }).select('name email contactNumber').sort({ name: 1 });

    res.status(200).json(doctors);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ message: 'Failed to fetch doctors' });
  }
};

// Update the existing functions to maintain doctor assignment logic
export const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      dateOfBirth, 
      gender, 
      occupation, 
      spouseName, 
      spouseOccupation, 
      spouseDateOfBirth, 
      address, 
      contactNumber, 
      email, 
      doctorId,
      centerCode 
    } = req.body;

    // Check if patient exists
    const existingPatient = await Patient.findById(id);
    if (!existingPatient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Get current user
    const currentUser = await User.findById(req.user.id).populate('center');
    
    // Find center by centerCode if provided
    let center = existingPatient.center;
    if (centerCode) {
      const foundCenter = await Center.findOne({ centerCode });
      if (!foundCenter) {
        return res.status(404).json({ message: 'Center not found' });
      }
      center = foundCenter._id;
    }

    // Check for email duplicates (excluding current patient)
    if (email && email.toLowerCase() !== existingPatient.email) {
      const duplicatePatient = await Patient.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: id }
      });
      if (duplicatePatient) {
        return res.status(400).json({ message: 'Patient with this email already exists' });
      }
    }

    // Doctor assignment logic for updates
    let assignedDoctorId = existingPatient.doctorId;

    if (currentUser.role === 'Doctor') {
      // Doctors can only assign themselves or remove assignment
      if (doctorId !== undefined) {
        if (doctorId === null || doctorId === currentUser._id.toString()) {
          assignedDoctorId = doctorId;
        } else {
          return res.status(403).json({ 
            message: 'Doctors can only assign themselves or remove doctor assignment' 
          });
        }
      }
    } else if (['Receptionist', 'Admin', 'superAdmin'].includes(currentUser.role)) {
      // Receptionist/Admin can assign any doctor from their center
      if (doctorId !== undefined) {
        if (doctorId === null) {
          assignedDoctorId = null;
        } else {
          // Validate doctor
          const doctor = await User.findOne({ 
            _id: doctorId, 
            role: 'Doctor', 
            center: currentUser.center._id,
            isActive: true 
          });
          
          if (!doctor) {
            return res.status(400).json({ 
              message: 'Invalid doctor selected or doctor not available in your center' 
            });
          }
          
          assignedDoctorId = doctorId;
        }
      }
    }

    const updateData = {
      name: name?.trim() || existingPatient.name,
      dateOfBirth: dateOfBirth || existingPatient.dateOfBirth,
      gender: gender || existingPatient.gender,
      occupation: occupation?.trim() || existingPatient.occupation,
      spouseName: spouseName?.trim() || existingPatient.spouseName,
      spouseOccupation: spouseOccupation?.trim() || existingPatient.spouseOccupation,
      spouseDateOfBirth: spouseDateOfBirth || existingPatient.spouseDateOfBirth,
      address: address?.trim() || existingPatient.address,
      contactNumber: contactNumber?.trim() || existingPatient.contactNumber,
      email: email?.toLowerCase().trim() || existingPatient.email,
      center,
      doctorId: assignedDoctorId,
      updatedBy: currentUser._id
    };

    const updatedPatient = await Patient.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    )
      .populate('center', 'name address contactNumber')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('doctorId', 'name email');

    res.status(200).json(updatedPatient);
  } catch (error) {
    console.error('Error updating patient:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ message: errors.join(', ') });
    }
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({ message: `Another patient with this ${field} already exists` });
    }
    
    res.status(500).json({ message: 'Failed to update patient' });
  }
};

// Export all existing functions with the new ones
// export {
//   getAllPatients,
//   getPatientById,
//   deletePatient,
//   getPatientsByCenter,
//   getPatientsByUser,
//   getActivePatients,
//   togglePatientStatus
// } from "../controllers/patientController.js";

export const getAllPatients = async (req, res) => {
  try {
    const patients = await Patient.find()
      .populate('center', 'name address contactNumber')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('doctorId', 'name email');
    
    res.status(200).json(patients);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ message: 'Failed to fetch patients' });
  }
}

export const getPatientById = async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await Patient.findById(id)
      .populate('center', 'name address contactNumber')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('doctorId', 'name email');

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    res.status(200).json(patient);
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({ message: 'Failed to fetch patient' });
  }
}


export const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedPatient = await Patient.findByIdAndDelete(id);

    if (!deletedPatient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    res.status(200).json({ message: 'Patient deleted successfully' });
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({ message: 'Failed to delete patient' });
  }
}

export const getPatientsByCenter = async (req, res) => {
  try {
    const { centerCode } = req.params;
    const center = await Center.findOne({ centerCode });
    if (!center) {
      return res.status(404).json({ message: 'Center not found' });
    }   
    
    const patients = await Patient.find({ center: center._id })
      .populate('center', 'name address contactNumber')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('doctorId', 'name email');
    
    res.status(200).json(patients); 
  } catch (error) {
    console.error('Error fetching patients by center:', error);
    res.status(500).json({ message: 'Failed to fetch patients by center' });
  }
}

export const getPatientsByUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).populate('center');

    if (!user || !user.center) {
      return res.status(404).json({ message: 'No center found for this user' });
    }

    const patients = await Patient.find({ center: user.center._id })
      .populate('center', 'name address contactNumber')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email').populate('doctorId', 'name email');     
    res.status(200).json(patients);
  } catch (error) {
    console.error('Error fetching patients by user:', error);
    res.status(500).json({ message: 'Failed to fetch patients by user' });
  }
}

export const getActivePatients = async (req, res) => {
  try {
    const activePatients = await Patient.find({ isActive: true })
      .populate('center', 'name address contactNumber')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('doctorId', 'name email');
    
    res.status(200).json(activePatients);
  } catch (error) {
    console.error('Error fetching active patients:', error);
    res.status(500).json({ message: 'Failed to fetch active patients' });
  }
}

export const togglePatientStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive must be a boolean value' });
    }

    const updatedPatient = await Patient.findByIdAndUpdate(
      id, 
      { isActive }, 
      { new: true, runValidators: true }
    )
      .populate('center', 'name address contactNumber')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('doctorId', 'name email');  

    if (!updatedPatient) {
        return res.status(404).json({ message: 'Patient not found' });  
    }
    res.status(200).json(updatedPatient);
  } catch (error) {
    console.error('Error toggling patient status:', error);
    res.status(500).json({ message: 'Failed to toggle patient status' });
  } 
}