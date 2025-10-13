import mongoose from 'mongoose';

const testMasterSchema = new mongoose.Schema({
  testCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  testName: {
    type: String,
    required: true,
    trim: true
  },
  testPrice: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    enum: ['Blood Test', 'Urine Test', 'Imaging', 'Genetic Test', 'Hormone Test', 'Other'],
    default: 'Other'
  },
  duration: {
    type: String,
    default: '24 hours'
  },
  sampleType: {
    type: String,
    enum: ['Blood', 'Urine', 'Saliva', 'Tissue', 'Swab', 'Other'],
    default: 'Blood'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for better query performance
testMasterSchema.index({ testCode: 1 });
testMasterSchema.index({ testName: 1 });
testMasterSchema.index({ isActive: 1 });

export default mongoose.model('TestMaster', testMasterSchema);







