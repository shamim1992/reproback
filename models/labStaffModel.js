import mongoose from 'mongoose';

const labStaffSchema = new mongoose.Schema({
  staffName: {
    type: String,
    required: [true, 'Staff name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password should be at least 6 characters']
  },
  role: {
    type: String,
    enum: {
      values: ['Lab Manager', 'Lab Technician', 'Lab Assistant', 'Lab Director', 'Quality Control'],
      message: '{VALUE} is not a valid lab role'
    },
    required: [true, 'Role is required'],
    default: 'Lab Technician'
  },
  specialization: {
    type: [String],
    default: []
  },
  qualifications: {
    type: String,
    trim: true
  },
  experience: {
    type: Number, // years of experience
    default: 0
  },
  licenseNumber: {
    type: String,
    trim: true
  },
  licenseExpiry: {
    type: Date
  },
  centerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center',
    required: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  // Password reset fields
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for better performance
labStaffSchema.index({ email: 1 });
labStaffSchema.index({ centerId: 1 });
labStaffSchema.index({ role: 1 });
labStaffSchema.index({ isActive: 1 });

const LabStaff = mongoose.model('LabStaff', labStaffSchema);

export default LabStaff;
