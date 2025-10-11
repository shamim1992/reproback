import mongoose from 'mongoose';

const medicationSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  medicationName: {
    type: String,
    required: [true, 'Medication name is required'],
    trim: true
  },
  dosage: {
    type: String,
    required: [true, 'Dosage is required'],
    trim: true
  },
  frequency: {
    type: String,
    required: [true, 'Frequency is required'],
    trim: true
  },
  route: {
    type: String,
    enum: ['Oral', 'Injection', 'Topical', 'Inhalation', 'IV', 'Subcutaneous', 'Intramuscular', 'Other'],
    default: 'Oral'
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  prescribedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: {
    type: String,
    trim: true
  },
  center: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center',
    required: true
  }
}, {
  timestamps: true
});

// Index for better query performance
medicationSchema.index({ patient: 1, isActive: 1 });
medicationSchema.index({ patient: 1, createdAt: -1 });

const Medication = mongoose.model('Medication', medicationSchema);

export default Medication;

