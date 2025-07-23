import User from '../models/userModel.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';
import Department from '../models/departmentModel.js'

// User signup
export const registerUser = async (req, res) => {

  try {
    const { name, username, email, password, role, department, specialization, consultationCharges, contactNumber } = req.body;

    const userExists = await User.findOne({ email });
    console.log("Existing user : ", userExists)
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }
    if (role === 'Doctor') {
      const departments = await Department.findById(department);

      if (!departments) {
        return res.status(404).json({ message: 'Department not found' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      username,
      email,
      password: hashedPassword,
      role,
      contactNumber,
      department: role === 'Doctor' ? department : null,
      specialization: role === 'Doctor' ? specialization : null,
      consultationCharges: role === 'Doctor' ? consultationCharges : null,
    });

    const token = jwt.sign({ id: user._id, role: user.role }, jwtConfig.secret, {
      expiresIn: jwtConfig.expiresIn,
    });

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user._id, name: user.name, role: user.role },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};

// User login localstorage
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({email});

    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, jwtConfig.secret, {
      expiresIn: jwtConfig.expiresIn,
    });

    return res.status(200).json({
      message: 'Logged in successfully',
      token,
      user,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};

// Get user profile
export const getUserProfile = async (req, res) => {
  const { id } = req.user;

  try {
    const user = await User.findById(id).select('-password'); // Exclude password

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ user });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};
