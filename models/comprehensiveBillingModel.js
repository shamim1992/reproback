import mongoose from 'mongoose';

const comprehensiveBillingSchema = new mongoose.Schema({
  // Patient information
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  
  // Doctor who will provide consultation
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Center information
  center: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center',
    required: true
  },
  
  // Billing details
  billNumber: {
    type: String,
    required: false,
    unique: true
  },
  
  // Registration fee (first time registration only)
  registrationFee: {
    amount: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    patientType: {
      type: String,
      enum: ['OP', 'IP'],
      default: 'OP'
    },
    description: {
      type: String,
      default: 'Registration'
    },
    isApplicable: {
      type: Boolean,
      default: true
    }
  },
  
  // Doctor consultation fee
  consultationFee: {
    amount: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    consultationType: {
      type: String,
      enum: ['op_general', 'ip_general', 'op_audio', 'op_video', 'op_followup'],
      default: 'op_general'
    },
    patientType: {
      type: String,
      enum: ['OP', 'IP'],
      default: 'OP'
    },
    description: {
      type: String,
      default: 'Consultation'
    }
  },
  
  // Service charges (additional services)
  serviceCharges: [{
    serviceName: {
      type: String,
      required: true
    },
    serviceCode: {
      type: String,
      required: true
    },
    patientType: {
      type: String,
      enum: ['OP', 'IP'],
      default: 'OP'
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1
    },
    totalAmount: {
      type: Number,
      required: true
    },
    description: {
      type: String
    }
  }],
  
  // Pricing breakdown
  subtotal: {
    type: Number,
    required: false,
    min: 0
  },
  
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  
  totalAmount: {
    type: Number,
    required: false,
    min: 0
  },
  
  // Payment information
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'partial', 'cancelled', 'refunded'],
    default: 'pending'
  },
  
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'netbanking', 'cheque', 'insurance'],
    default: null
  },
  
  paymentDate: {
    type: Date
  },
  
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Payment history for partial payments
  paymentHistory: [{
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'netbanking', 'cheque', 'insurance', 'adjustment'],
      required: true
    },
    paymentDate: {
      type: Date,
      default: Date.now
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    notes: {
      type: String,
      maxlength: 200
    },
    receiptNumber: {
      type: String
    }
  }],
  
  // Billing status and workflow
  status: {
    type: String,
    enum: ['draft', 'preview', 'generated', 'sent', 'paid', 'partial', 'cancelled', 'refunded'],
    default: 'draft'
  },
  
  // Consultation status (for doctor workflow)
  consultationStatus: {
    type: String,
    enum: ['pending', 'viewed', 'in_progress', 'completed'],
    default: 'pending'
  },
  
  viewedAt: {
    type: Date
  },
  
  viewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Preview invoice data
  previewInvoice: {
    generatedAt: {
      type: Date
    },
    expiresAt: {
      type: Date
    },
    isApproved: {
      type: Boolean,
      default: false
    },
    approvedAt: {
      type: Date
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Due date for payment
  dueDate: {
    type: Date
  },
  
  // Notes and remarks
  notes: {
    type: String,
    maxlength: 500
  },
  
  // Cancellation information
  cancellation: {
    isCancelled: {
      type: Boolean,
      default: false
    },
    cancelledAt: {
      type: Date
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    cancellationReason: {
      type: String,
      maxlength: 200
    },
    refundAmount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Refund information
  refund: {
    isRefunded: {
      type: Boolean,
      default: false
    },
    refundedAt: {
      type: Date
    },
    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    refundAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    refundMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'netbanking', 'cheque']
    },
    refundReason: {
      type: String,
      maxlength: 200
    },
    refundReference: {
      type: String
    }
  },
  
  // Billing workflow
  workflow: {
    currentStage: {
      type: String,
      enum: ['billing', 'preview', 'payment', 'consultation', 'completed', 'cancelled', 'refunded'],
      default: 'billing'
    },
    stages: [{
      stage: {
        type: String,
        enum: ['billing', 'preview', 'payment', 'consultation', 'completed', 'cancelled', 'refunded']
      },
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'cancelled']
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      notes: String
    }]
  },
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Soft delete
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
comprehensiveBillingSchema.index({ billNumber: 1 });
comprehensiveBillingSchema.index({ patient: 1 });
comprehensiveBillingSchema.index({ doctor: 1 });
comprehensiveBillingSchema.index({ center: 1 });
comprehensiveBillingSchema.index({ paymentStatus: 1 });
comprehensiveBillingSchema.index({ status: 1 });
comprehensiveBillingSchema.index({ createdAt: -1 });

// Pre-save middleware to generate bill number and calculate totals
comprehensiveBillingSchema.pre('save', async function(next) {
  try {
    if (this.isNew && !this.billNumber) {
      const count = await this.constructor.countDocuments();
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const day = String(new Date().getDate()).padStart(2, '0');
      const sequence = String(count + 1).padStart(4, '0');
      
      this.billNumber = `BILL-${year}${month}${day}-${sequence}`;
    }
    
    // Calculate service charges total
    let serviceChargesTotal = 0;
    if (this.serviceCharges && this.serviceCharges.length > 0) {
      this.serviceCharges.forEach(service => {
        service.totalAmount = service.amount * service.quantity;
        serviceChargesTotal += service.totalAmount;
      });
    }
    
    // Calculate subtotal (only include registration fee if applicable)
    const regFee = this.registrationFee.isApplicable ? (this.registrationFee.amount || 0) : 0;
    this.subtotal = regFee + 
                   (this.consultationFee.amount || 0) + 
                   serviceChargesTotal;
    
    // Calculate total amount
    this.totalAmount = this.subtotal - (this.discount || 0) + (this.tax || 0);
    
    next();
  } catch (error) {
    console.error('Comprehensive billing pre-save middleware error:', error);
    next(error);
  }
});

// Virtual for remaining amount
comprehensiveBillingSchema.virtual('remainingAmount').get(function() {
  return this.totalAmount - this.paidAmount;
});

// Virtual for payment percentage
comprehensiveBillingSchema.virtual('paymentPercentage').get(function() {
  if (this.totalAmount === 0) return 0;
  return Math.round((this.paidAmount / this.totalAmount) * 100);
});

// Virtual for total service charges
comprehensiveBillingSchema.virtual('totalServiceCharges').get(function() {
  if (!this.serviceCharges || this.serviceCharges.length === 0) return 0;
  return this.serviceCharges.reduce((sum, service) => sum + service.totalAmount, 0);
});

// Ensure virtual fields are serialized
comprehensiveBillingSchema.set('toJSON', { virtuals: true });
comprehensiveBillingSchema.set('toObject', { virtuals: true });

const ComprehensiveBilling = mongoose.model('ComprehensiveBilling', comprehensiveBillingSchema);

export default ComprehensiveBilling;
