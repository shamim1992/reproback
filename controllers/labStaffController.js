import User from '../models/userModel.js';
import bcrypt from 'bcryptjs';

// Get all lab staff
export const getAllLabStaff = async (req, res) => {
  try {
    const labRoles = ['Lab Manager', 'Lab Technician', 'Lab Assistant', 'Lab Director', 'Quality Control'];
    const labStaff = await User.find({ 
      role: { $in: labRoles },
      isActive: true 
    })
      .select('-password')
      .populate('centerId', 'name')
      .sort({ createdAt: -1 });
    
    res.status(200).json(labStaff);
  } catch (error) {
    console.error('Error fetching lab staff:', error);
    res.status(500).json({ message: 'Failed to fetch lab staff' });
  }
};

// Get lab staff by ID
export const getLabStaffById = async (req, res) => {
  try {
    const { id } = req.params;
    const labStaff = await User.findById(id).select('-password').populate('centerId', 'name');
    
    if (!labStaff) {
      return res.status(404).json({ message: 'Lab staff not found' });
    }
    
    // Check if user has lab role
    const labRoles = ['Lab Manager', 'Lab Technician', 'Lab Assistant', 'Lab Director', 'Quality Control'];
    if (!labRoles.includes(labStaff.role)) {
      return res.status(404).json({ message: 'User is not lab staff' });
    }
    
    res.status(200).json(labStaff);
  } catch (error) {
    console.error('Error fetching lab staff by ID:', error);
    res.status(500).json({ message: 'Failed to fetch lab staff' });
  }
};

// Create new lab staff
export const createLabStaff = async (req, res) => {
  try {
    console.log('Creating lab staff with data:', req.body);
    const {
      firstName,
      lastName,
      email,
      phone,
      role,
      password,
      centerId
    } = req.body;

    // Check if email already exists
    const existingStaff = await User.findOne({ email });
    if (existingStaff) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new lab staff as User
    const newLabStaff = new User({
      firstName: firstName || '',
      lastName: lastName || '',
      email,
      phone,
      role: role || 'Lab Technician',
      password: hashedPassword,
      centerId: centerId || undefined,
      isActive: true
    });

    const savedLabStaff = await newLabStaff.save();
    
    // Return lab staff without password
    const { password: _, ...labStaffWithoutPassword } = savedLabStaff.toObject();
    
    res.status(201).json({
      message: 'Lab staff created successfully',
      labStaff: labStaffWithoutPassword
    });
  } catch (error) {
    console.error('Error creating lab staff:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Failed to create lab staff', error: error.message });
  }
};

// Update lab staff
export const updateLabStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // If password is being updated, hash it
    if (updateData.password) {
      const saltRounds = 10;
      updateData.password = await bcrypt.hash(updateData.password, saltRounds);
    }

    // Handle phone field (if it's being sent as contactNumber)
    if (updateData.contactNumber) {
      updateData.phone = updateData.contactNumber;
      delete updateData.contactNumber;
    }

    const updatedLabStaff = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password').populate('centerId', 'name');

    if (!updatedLabStaff) {
      return res.status(404).json({ message: 'Lab staff not found' });
    }

    res.status(200).json({
      message: 'Lab staff updated successfully',
      labStaff: updatedLabStaff
    });
  } catch (error) {
    console.error('Error updating lab staff:', error);
    res.status(500).json({ message: 'Failed to update lab staff' });
  }
};

// Delete lab staff (soft delete)
export const deleteLabStaff = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedLabStaff = await User.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    ).select('-password').populate('centerId', 'name');

    if (!deletedLabStaff) {
      return res.status(404).json({ message: 'Lab staff not found' });
    }

    res.status(200).json({
      message: 'Lab staff deleted successfully',
      labStaff: deletedLabStaff
    });
  } catch (error) {
    console.error('Error deleting lab staff:', error);
    res.status(500).json({ message: 'Failed to delete lab staff' });
  }
};

// Get lab staff by center ID
export const getLabStaffByCenterId = async (req, res) => {
  try {
    const { centerId } = req.params;
    const labRoles = ['Lab Manager', 'Lab Technician', 'Lab Assistant', 'Lab Director', 'Quality Control'];
    
    const labStaff = await User.find({ 
      centerId, 
      role: { $in: labRoles },
      isActive: true 
    }).select('-password').populate('centerId', 'name').sort({ createdAt: -1 });

    res.status(200).json(labStaff);
  } catch (error) {
    console.error('Error fetching lab staff by center ID:', error);
    res.status(500).json({ message: 'Failed to fetch lab staff' });
  }
};

// Get lab staff statistics
export const getLabStaffStats = async (req, res) => {
  try {
    const labRoles = ['Lab Manager', 'Lab Technician', 'Lab Assistant', 'Lab Director', 'Quality Control'];
    
    const totalStaff = await User.countDocuments({ 
      role: { $in: labRoles },
      isActive: true 
    });
    const staffByRole = await User.aggregate([
      { $match: { role: { $in: labRoles }, isActive: true } },
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);
    const staffByCenter = await User.aggregate([
      { $match: { role: { $in: labRoles }, isActive: true } },
      { $group: { _id: '$centerId', count: { $sum: 1 } } }
    ]);

    res.status(200).json({
      totalStaff,
      staffByRole,
      staffByCenter
    });
  } catch (error) {
    console.error('Error fetching lab staff statistics:', error);
    res.status(500).json({ message: 'Failed to fetch lab staff statistics' });
  }
};
