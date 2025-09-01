import User from '../models/userModel.js';
import Center from '../models/centerModel.js';
import bcrypt from 'bcryptjs';

// Create user with center assignment logic
export const createUser = async (req, res) => {
  const { name, username, email, password, role, contactNumber, centerCode } = req.body;

  try {
    // Input validation
    if (!name || !username || !email || !password || !role || !contactNumber) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }]
    });

    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }
      if (existingUser.username === username) {
        return res.status(400).json({ message: 'Username already taken' });
      }
    }

    let centerToAssign = null;

    // Role-based center assignment logic
    if (role === 'Admin') {
      // SuperAdmin creates Admin and assigns to a center
      if (req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'Only SuperAdmin can create Admins' });
      }
      
      if (!centerCode) {
        return res.status(400).json({ message: 'Center code is required when creating Admin' });
      }

      // Find the center by center code
      centerToAssign = await Center.findOne({ centerCode: centerCode.trim() });
      if (!centerToAssign) {
        return res.status(404).json({ message: 'Center not found with provided center code' });
      }

    } else if (role === 'Doctor' || role === 'Receptionist') {
      // Admin creates Doctor/Receptionist for their center
      if (req.user.role !== 'Admin' && req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'Only Admin or SuperAdmin can create Doctors/Receptionists' });
      }

      if (req.user.role === 'Admin') {
        // Admin can only create users for their own center
        const adminUser = await User.findById(req.user.id).populate('center');
        if (!adminUser || !adminUser.center) {
          return res.status(400).json({ message: 'Admin must be assigned to a center to create users' });
        }
        centerToAssign = adminUser.center;
      } else if (req.user.role === 'superAdmin') {
        // SuperAdmin can assign to any center if centerCode is provided
        if (centerCode) {
          centerToAssign = await Center.findOne({ centerCode: centerCode.trim() });
          if (!centerToAssign) {
            return res.status(404).json({ message: 'Center not found with provided center code' });
          }
        }
      }

    } else if (role === 'superAdmin') {
      // Only existing SuperAdmin can create another SuperAdmin
      if (req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'Only SuperAdmin can create other SuperAdmins' });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name: name.trim(),
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role,
      contactNumber: contactNumber.trim(),
      center: centerToAssign ? centerToAssign._id : null,
    });

    const savedUser = await newUser.save();
    
    // Populate center info before sending response
    await savedUser.populate('center', 'name centerCode address');
    
    // Remove password from response
    const userResponse = savedUser.toObject();
    delete userResponse.password;
    delete userResponse.resetPasswordToken;
    delete userResponse.resetPasswordExpires;

    res.status(201).json({
      message: 'User created successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Create user error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ message: errors.join(', ') });
    }
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({ message: `User with this ${field} already exists` });
    }
    
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// Update a user
export const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, contactNumber, centerCode } = req.body;

  try {
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Role-based access control
    if (req.user.role === 'Admin') {
      const adminUser = await User.findById(req.user.id);
      if (adminUser && adminUser.center && 
          (!existingUser.center || existingUser.center.toString() !== adminUser.center.toString())) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.toLowerCase().trim();
    if (contactNumber) updateData.contactNumber = contactNumber.trim();

    // Handle center reassignment (only SuperAdmin can do this)
    if (centerCode && req.user.role === 'superAdmin') {
      const newCenter = await Center.findOne({ centerCode: centerCode.trim() });
      if (!newCenter) {
        return res.status(404).json({ message: 'Center not found with provided center code' });
      }
      updateData.center = newCenter._id;
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('center', 'name centerCode address')
     .select('-password -resetPasswordToken -resetPasswordExpires');

    res.status(200).json({
      message: 'User updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Update user error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ message: errors.join(', ') });
    }
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({ message: `Another user with this ${field} already exists` });
    }
    
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// Delete a user
export const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Role-based access control
    if (req.user.role === 'Admin') {
      const adminUser = await User.findById(req.user.id);
      if (adminUser && adminUser.center && 
          (!user.center || user.center.toString() !== adminUser.center.toString())) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // Prevent deletion of SuperAdmin by non-SuperAdmin
    if (user.role === 'superAdmin' && req.user.role !== 'superAdmin') {
      return res.status(403).json({ message: 'Cannot delete SuperAdmin' });
    }

    await User.findByIdAndDelete(id);
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// Get Doctor by ID
export const getDoctorById = async (req, res) => {
  const { id } = req.params;
  try {
    const doctor = await User.findById(id)
      .populate('center', 'name centerCode address');
      
    if (!doctor || doctor.role !== 'Doctor') {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Role-based access control
    if (req.user.role === 'Admin') {
      const adminUser = await User.findById(req.user.id);
      if (adminUser && adminUser.center && 
          (!doctor.center || doctor.center._id.toString() !== adminUser.center.toString())) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // Remove sensitive data
    const doctorResponse = doctor.toObject();
    delete doctorResponse.password;
    delete doctorResponse.resetPasswordToken;
    delete doctorResponse.resetPasswordExpires;

    res.status(200).json(doctorResponse);
  } catch (error) {
    console.error('Get doctor by ID error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// Get all doctors (with center filtering for Admin)
export const getDoctors = async (req, res) => {
  try {
    let query = { role: 'Doctor', isActive: true };

    // Role-based access control
    if (req.user.role === 'Admin') {
      const adminUser = await User.findById(req.user.id);
      if (adminUser && adminUser.center) {
        query.center = adminUser.center;
      } else {
        return res.status(400).json({ message: 'Admin must be assigned to a center' });
      }
    }

    const doctors = await User.find(query)
      .populate('center', 'name centerCode address')
      .select('-password -resetPasswordToken -resetPasswordExpires')
      .sort({ name: 1 });

    res.status(200).json(doctors);
  } catch (error) {
    console.error('Get doctors error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// Doctor search (with center filtering for Admin)
export const searchDoctor = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    let searchCriteria = {
      role: 'Doctor',
      isActive: true,
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { contactNumber: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    };

    // Role-based access control
    if (req.user.role === 'Admin') {
      const adminUser = await User.findById(req.user.id);
      if (adminUser && adminUser.center) {
        searchCriteria.center = adminUser.center;
      } else {
        return res.status(400).json({ message: 'Admin must be assigned to a center' });
      }
    }

    const doctors = await User.find(searchCriteria)
      .populate('center', 'name centerCode address')
      .select('-password -resetPasswordToken -resetPasswordExpires')
      .limit(10)
      .sort({ name: 1 });

    res.status(200).json({
      count: doctors.length,
      doctors
    });
  } catch (error) {
    console.error('Search doctor error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// Get all users
export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find()
            .populate('center', 'name centerCode')
            .select('-password')
            .sort({ createdAt: -1 });
        
        res.status(200).json(users);
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Get users by center ID
export const getUsersByCenter = async (req, res) => {
    try {
        const { centerId } = req.params;
        
        // Verify that the center exists
        const center = await Center.findById(centerId);
        if (!center) {
            return res.status(404).json({ message: 'Center not found' });
        }

        // Find all users belonging to this center
        const users = await User.find({ center: centerId })
            .populate('center', 'name centerCode')
            .select('-password')
            .sort({ createdAt: -1 });
        
        res.status(200).json(users);
    } catch (error) {
        console.error('Get users by center error:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Get user by ID
export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const user = await User.findById(id)
            .populate('center', 'name centerCode address email contactNumber')
            .select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error('Get user by ID error:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};


// Toggle user status
export const toggleUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        if (typeof isActive !== 'boolean') {
            return res.status(400).json({ message: 'isActive must be a boolean value' });
        }

        const updatedUser = await User.findByIdAndUpdate(
            id,
            { isActive },
            { new: true, runValidators: true }
        )
        .populate('center', 'name centerCode')
        .select('-password');

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json(updatedUser);
    } catch (error) {
        console.error('Toggle user status error:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Update user role
export const updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        const validRoles = ['Admin', 'Manager', 'Employee', 'superAdmin'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ message: 'Invalid role specified' });
        }

        const updatedUser = await User.findByIdAndUpdate(
            id,
            { role },
            { new: true, runValidators: true }
        )
        .populate('center', 'name centerCode')
        .select('-password');

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json(updatedUser);
    } catch (error) {
        console.error('Update user role error:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Get users by current user's center


export const getUsersByCurrentUserCenter = async (req, res) => {
    try {
        const userId = req.user.id;
        const currentUser = await User.findById(userId).populate('center');

        if (!currentUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!currentUser.center) {
            return res.status(404).json({ message: 'No center found for this user' });
        }

        // Find all users in the same center
        const users = await User.find({ center: currentUser.center._id })
            .populate('center', 'name centerCode')
            .select('-password -resetPasswordToken -resetPasswordExpires')
            .sort({ createdAt: -1 });
        
        res.status(200).json(users);
    } catch (error) {
        console.error('Get users by current user center error:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};