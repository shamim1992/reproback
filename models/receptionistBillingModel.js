import mongoose from 'mongoose';

const receptionistBillingSchema = new mongoose.Schema({
  billingNumber: {
    type: String,
    required: true,
    unique: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Not required for registration and service charges
  },
  centerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center',
    required: true
  },
  billingType: {
    type: String,
    required: true,
    enum: ['consultation', 'registration', 'service', 'reassignment']
  },
  baseAmount: {
    type: Number,
    required: true,
    min: 0
  },
  additionalCharges: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['cash', 'card', 'upi', 'netbanking', 'cheque']
  },
  paymentStatus: {
    type: String,
    default: 'paid',
    enum: ['paid', 'pending', 'failed']
  },
  notes: {
    type: String,
    default: ''
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  billingDate: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
receptionistBillingSchema.index({ billingNumber: 1 });
receptionistBillingSchema.index({ patientId: 1 });
receptionistBillingSchema.index({ centerId: 1 });
receptionistBillingSchema.index({ billingType: 1 });
receptionistBillingSchema.index({ billingDate: -1 });
receptionistBillingSchema.index({ processedBy: 1 });

// Virtual for payment percentage
receptionistBillingSchema.virtual('paymentPercentage').get(function() {
  if (this.totalAmount === 0) return 0;
  return Math.round((this.baseAmount / this.totalAmount) * 100);
});

// Virtual for formatted billing date
receptionistBillingSchema.virtual('formattedBillingDate').get(function() {
  return this.billingDate.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Ensure virtual fields are serialized
receptionistBillingSchema.set('toJSON', { virtuals: true });
receptionistBillingSchema.set('toObject', { virtuals: true });

// Pre-save middleware to calculate total amount
receptionistBillingSchema.pre('save', function(next) {
  if (this.isModified('baseAmount') || this.isModified('additionalCharges')) {
    this.totalAmount = this.baseAmount + this.additionalCharges;
  }
  next();
});

// Static method to get billing statistics
receptionistBillingSchema.statics.getBillingStats = async function(filter = {}) {
  try {
    const [
      totalBills,
      totalRevenue,
      billingTypeStats
    ] = await Promise.all([
      this.countDocuments(filter),
      this.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      this.aggregate([
        { $match: filter },
        { $group: { _id: '$billingType', count: { $sum: 1 }, total: { $sum: '$totalAmount' } } }
      ])
    ]);

    return {
      totalBills,
      totalRevenue: totalRevenue[0]?.total || 0,
      billingTypeStats
    };
  } catch (error) {
    console.error('Error getting billing stats:', error);
    throw error;
  }
};

// Instance method to check if patient is first-time
receptionistBillingSchema.methods.isFirstTimePatient = async function() {
  try {
    const previousBills = await this.constructor.countDocuments({
      patientId: this.patientId,
      billingDate: { $lt: this.billingDate }
    });
    return previousBills === 0;
  } catch (error) {
    console.error('Error checking first-time patient:', error);
    return false;
  }
};

const ReceptionistBilling = mongoose.model('ReceptionistBilling', receptionistBillingSchema);

export default ReceptionistBilling;










