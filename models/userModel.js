import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
  },
  lastName: {
    type: String,
    required: false,
    trim: true,
    default: '',
  },
  username:{
    type: String,
    required: [true, 'Username is required'],
    unique: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password should be at least 6 characters'],
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
  },
  role: {
    type: String,
    enum: {
      values: ['Admin', 'Doctor', 'Receptionist', 'Accountant', 'superAdmin', 'Lab Manager', 'Lab Technician', 'Lab Assistant', 'Lab Director', 'Quality Control', 'Super Consultant'],
      message: '{VALUE} is not a valid role',
    },
    required: true,
  },
  department: {
    type: String,
    trim: true,
    required: false,
    default: '',
  },
  centerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center',
  },
  
  isActive: {
    type: Boolean,
    default: true,
  },
  // Password reset fields
  resetPasswordToken: {
    type: String,
    default: null,
  },
  resetPasswordExpires: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

const User = mongoose.model('User', userSchema);

export default User;