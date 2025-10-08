import mongoose from 'mongoose';

const testRequestSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  testTypes: [{
    type: String,
    required: true
  }],
  priority: {
    type: String,
    enum: ['Low', 'Normal', 'High', 'Urgent'],
    default: 'Normal'
  },
  status: {
    type: String,
    enum: [
      'Pending',
      'Billing_Pending',
      'Billing_Generated',
      'Billing_Paid',
      'Superadmin_Approved',
      'Assigned',
      'Sample_Collection_Scheduled',
      'Sample_Collection_Delayed',
      'Sample_Collection_Rescheduled',
      'Sample_Collected',
      'Sample_Collection_Failed',
      'In_Lab_Testing',
      'Testing_Delayed',
      'Testing_Completed',
      'Report_Generated',
      'Report_Sent',
      'Completed',
      'Cancelled',
      'On_Hold',
      'Needs_Additional_Tests',
      'Review_Rejected'
    ],
    default: 'Pending'
  },
  
  // Reference to billing record
  billingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Billing'
  },
  notes: {
    type: String,
    default: ''
  },
  labReport: {
    fileName: String,
    filePath: String,
    downloadUrl: String,
    generatedDate: Date,
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  centerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center',
    required: true
  },
  billingInfo: {
    amount: Number,
    billingDate: Date,
    paidDate: Date,
    paymentMethod: String
  },
  sampleCollection: {
    scheduledDate: Date,
    collectedDate: Date,
    collectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: String
  },
  // New sample collection fields for enhanced workflow
  scheduledCollectionDate: Date,
  scheduledCollectionTime: String,
  assignedCollector: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedCollectorName: String,
  collectionNotes: String,
  sampleCollectedDate: Date,
  sampleCollectedTime: String,
  labTesting: {
    startedDate: Date,
    completedDate: Date,
    testedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    results: String,
    notes: String
  },
  superConsultantReview: {
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewDate: Date,
    feedback: String,
    additionalTestsRequired: [String],
    recommendations: String,
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Needs_Additional_Tests', 'Rejected'],
      default: 'Pending'
    },
    isReviewed: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Index for better query performance
testRequestSchema.index({ doctorId: 1, createdAt: -1 });
testRequestSchema.index({ patientId: 1, createdAt: -1 });
testRequestSchema.index({ status: 1 });
testRequestSchema.index({ centerId: 1 });

export default mongoose.model('TestRequest', testRequestSchema);