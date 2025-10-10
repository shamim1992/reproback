import User from "../models/userModel.js";
import Center from "../models/centerModel.js";
import Patient from "../models/patientModel.js";


export const createPatient = async (req, res) => {
  try {
    console.log('Create patient request body:', req.body);
    console.log('User creating patient:', req.user);
    
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

    // Validate required fields
    if (!name || !dateOfBirth || !gender || !occupation || !address || !contactNumber || !email) {
      return res.status(400).json({ 
        message: 'Missing required fields. Please fill in all required information.' 
      });
    }

    // Get the current user who is creating the patient
    const currentUser = await User.findById(req.user.id).populate('centerId');
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('Current user:', {
      id: currentUser._id,
      role: currentUser.role,
      centerId: currentUser.centerId
    });

    // Always use the current user's assigned center
    if (!currentUser.centerId) {
      return res.status(400).json({ 
        message: 'Your account is not assigned to any center. Please contact your administrator.' 
      });
    }
    
    const center = currentUser.centerId;

    // Check if patient with same email already exists
    const existingPatient = await Patient.findOne({ email: email.toLowerCase() });
    if (existingPatient) {
      return res.status(400).json({ message: 'Patient with this email already exists' });
    }

    // Generate UHID: CenterCode (4 digits) + Sequential Number (4 digits)
    const centerCode = center.centerCode.toString().padStart(4, '0');
    
    // Find the last patient for this center to get the next sequential number
    const lastPatient = await Patient.findOne({ center: center._id })
      .sort({ createdAt: -1 })
      .select('uhid');
    
    let sequentialNumber = 1;
    if (lastPatient && lastPatient.uhid) {
      // Extract the last 4 digits and increment
      const lastSequence = parseInt(lastPatient.uhid.slice(-4));
      sequentialNumber = lastSequence + 1;
    }
    
    const uhid = `${centerCode}${sequentialNumber.toString().padStart(4, '0')}`;
    
    console.log('Generated UHID:', uhid);
    console.log('Center code:', centerCode);
    console.log('Sequential number:', sequentialNumber);

    // Doctor assignment logic based on user role
    let assignedDoctorId = null;

    console.log('Doctor assignment - User role:', currentUser.role);
    console.log('Doctor assignment - Provided doctorId:', doctorId);

    if (currentUser.role === 'Doctor') {
      // If doctor is creating patient, auto-assign themselves
      assignedDoctorId = currentUser._id;
      console.log('Auto-assigning doctor (current user):', assignedDoctorId);
    } else if (currentUser.role === 'Receptionist' || currentUser.role === 'Admin' || currentUser.role === 'superAdmin') {
      // If receptionist/admin is creating patient, use provided doctorId
      if (doctorId) {
        console.log('Validating provided doctorId:', doctorId);
        // Validate that the doctor exists and belongs to the same center
        const doctor = await User.findOne({ 
          _id: doctorId, 
          role: 'Doctor', 
          centerId: center._id,
          isActive: true 
        });
        
        console.log('Doctor found:', doctor ? `${doctor.firstName} ${doctor.lastName}` : 'Not found');
        
        if (!doctor) {
          return res.status(400).json({ 
            message: 'Invalid doctor selected or doctor not available in your center' 
          });
        }
        
        assignedDoctorId = doctorId;
        console.log('Assigned doctorId:', assignedDoctorId);
      } else {
        console.log('No doctorId provided - patient will be unassigned');
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
    
    console.log('Final assignedDoctorId:', assignedDoctorId);


    const patientData = {
      uhid,
      name: name.trim(),
      dateOfBirth,
      gender,
      occupation: occupation.trim(),
      spouseName: spouseName ? spouseName.trim() : undefined,
      spouseOccupation: spouseOccupation ? spouseOccupation.trim() : undefined,
      spouseDateOfBirth: spouseDateOfBirth || undefined,
      address: address.trim(),
      contactNumber: contactNumber.trim(),
      email: email.toLowerCase().trim(),
      doctorId: assignedDoctorId, 
      center: center._id,
      createdBy: currentUser._id
    };

    console.log('Creating patient with data:', patientData);
    console.log('Doctor ID being saved:', patientData.doctorId);

    const patient = new Patient(patientData);

    const savedPatient = await patient.save();
    
    console.log('Patient saved successfully with UHID:', savedPatient.uhid);
    console.log('Patient saved with doctorId:', savedPatient.doctorId);
    
    // Populate the saved patient before returning
    await savedPatient.populate('center', 'name address contactNumber centerCode');
    await savedPatient.populate('createdBy', 'firstName lastName email');
    await savedPatient.populate('doctorId', 'firstName lastName email'); // Populate doctor info
    
    console.log('Populated patient doctor info:', savedPatient.doctorId);
    console.log('Returning patient to frontend:', {
      uhid: savedPatient.uhid,
      name: savedPatient.name,
      doctorId: savedPatient.doctorId
    });
    
    res.status(201).json(savedPatient);
  } catch (error) {
    console.error('Error creating patient:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      console.error('Validation errors:', errors);
      return res.status(400).json({ message: errors.join(', ') });
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      console.error('Duplicate key error on field:', field);
      return res.status(400).json({ message: `Patient with this ${field} already exists` });
    }
    
    res.status(500).json({ 
      message: 'Failed to create patient',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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
    const currentUser = await User.findById(req.user.id).populate('centerId');
    
    // Find center by centerCode if provided
    let center = existingPatient.center;
    if (centerCode) {
      const foundCenter = await Center.findOne({ centerCode });
      if (!foundCenter) {
        return res.status(404).json({ message: 'Center not found' });
      }
      center = foundCenter._id;
    } else if (currentUser.centerId) {
      center = currentUser.centerId._id;
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
            centerId: currentUser.centerId._id,
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
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .populate('doctorId', 'firstName lastName email');

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
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .populate('doctorId', 'firstName lastName email');
    
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
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .populate('doctorId', 'firstName lastName email');

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
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .populate('doctorId', 'firstName lastName email');
    
    res.status(200).json(patients); 
  } catch (error) {
    console.error('Error fetching patients by center:', error);
    res.status(500).json({ message: 'Failed to fetch patients by center' });
  }
}


export const getActivePatients = async (req, res) => {
  try {
    const activePatients = await Patient.find({ isActive: true })
      .populate('center', 'name address contactNumber')
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .populate('doctorId', 'firstName lastName email');
    
    res.status(200).json(activePatients);
  } catch (error) {
    console.error('Error fetching active patients:', error);
    res.status(500).json({ message: 'Failed to fetch active patients' });
  }
}

// Get patients assigned to a specific doctor
export const getPatientsByDoctor = async (req, res) => {
  try {
    const doctorId = req.user.id; // Get doctor ID from authenticated user
    const user = await User.findById(doctorId).populate('centerId');

    if (!user || user.role !== 'Doctor') {
      return res.status(403).json({ 
        message: 'Access denied. Only doctors can view their assigned patients.' 
      });
    }

    if (!user.centerId) {
      return res.status(404).json({ 
        message: 'No center found for this doctor' 
      });
    }

    // Import ComprehensiveBilling model
    const ComprehensiveBilling = (await import('../models/comprehensiveBillingModel.js')).default;

    // Find all comprehensive billing records with payment (paid or partial) for this doctor
    const paidBillings = await ComprehensiveBilling.find({
      doctor: doctorId,
      center: user.centerId._id,
      paymentStatus: { $in: ['paid', 'partial'] },
      paidAmount: { $gt: 0 },
      isActive: true
    }).select('patient').lean();

    // Extract unique patient IDs from paid billings
    const paidPatientIds = [...new Set(paidBillings.map(b => b.patient.toString()))];

    // Find patients assigned to this doctor who have paid consultation fees
    const patients = await Patient.find({ 
      _id: { $in: paidPatientIds },
      center: user.centerId._id 
    })
      .populate('center', 'name address contactNumber')
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .populate('doctorId', 'firstName lastName email')
      .sort({ createdAt: -1 }); // Sort by newest first
    
    res.status(200).json(patients);
  } catch (error) {
    console.error('Error fetching patients by doctor:', error);
    res.status(500).json({ message: 'Failed to fetch patients by doctor' });
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
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .populate('doctorId', 'firstName lastName email');  

    if (!updatedPatient) {
        return res.status(404).json({ message: 'Patient not found' });  
    }
    res.status(200).json(updatedPatient);
  } catch (error) {
    console.error('Error toggling patient status:', error);
    res.status(500).json({ message: 'Failed to toggle patient status' });
  } 
}

// Get patients by current user's center
export const getPatientsByUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).populate('centerId');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.centerId) {
      return res.status(400).json({ 
        message: 'Your account is not assigned to any center. Please contact your administrator.' 
      });
    }

    // Find patients in the user's center
    const patients = await Patient.find({ 
      center: user.centerId._id 
    })
      .populate('center', 'name address contactNumber')
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .populate('doctorId', 'firstName lastName email')
      .sort({ createdAt: -1 }); // Sort by newest first
    
    res.status(200).json(patients);
  } catch (error) {
    console.error('Error fetching patients by user:', error);
    res.status(500).json({ message: 'Failed to fetch patients by user' });
  }
}

// Get doctors by center
export const getDoctorsByCenter = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).populate('centerId');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.centerId) {
      return res.status(400).json({ 
        message: 'Your account is not assigned to any center. Please contact your administrator.' 
      });
    }

    // Find doctors in the user's center
    const doctors = await User.find({ 
      role: 'Doctor',
      centerId: user.centerId._id,
      isActive: true
    })
      .select('firstName lastName email phone')
      .sort({ firstName: 1 }); // Sort by first name
    
    res.status(200).json(doctors);
  } catch (error) {
    console.error('Error fetching doctors by center:', error);
    res.status(500).json({ message: 'Failed to fetch doctors by center' });
  }
}