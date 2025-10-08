import mongoose from 'mongoose';

const billingSchema = new mongoose.Schema({
  // Reference to the test request
  testRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TestRequest',
    required: true
  },
  
  // Patient information
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  
  // Doctor who requested the test
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
  
  // Test items and pricing
  testItems: [{
    testName: {
      type: String,
      required: true
    },
    testCode: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1
    },
    totalPrice: {
      type: Number,
      required: true
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
      enum: ['cash', 'card', 'upi', 'netbanking', 'cheque', 'insurance'],
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
  
  // Billing status
  status: {
    type: String,
    enum: ['draft', 'generated', 'sent', 'paid', 'cancelled'],
    default: 'draft'
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
  
  // Billing workflow
  workflow: {
    currentStage: {
      type: String,
      enum: ['billing', 'payment', 'lab_processing', 'completed'],
      default: 'billing'
    },
    stages: [{
      stage: {
        type: String,
        enum: ['billing', 'payment', 'lab_processing', 'completed']
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
billingSchema.index({ billNumber: 1 });
billingSchema.index({ testRequest: 1 });
billingSchema.index({ patient: 1 });
billingSchema.index({ center: 1 });
billingSchema.index({ paymentStatus: 1 });
billingSchema.index({ status: 1 });
billingSchema.index({ createdAt: -1 });

// Pre-save middleware to generate bill number
billingSchema.pre('save', async function(next) {
  try {
    if (this.isNew && !this.billNumber) {
      const count = await this.constructor.countDocuments();
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const day = String(new Date().getDate()).padStart(2, '0');
      const sequence = String(count + 1).padStart(4, '0');
      
      this.billNumber = `BILL-${year}${month}${day}-${sequence}`;
    }
    
    // Validate and calculate total price for each test item
    if (this.testItems && this.testItems.length > 0) {
      this.testItems.forEach(item => {
        if (typeof item.price === 'number' && typeof item.quantity === 'number') {
          // Recalculate totalPrice to ensure consistency
          item.totalPrice = item.price * item.quantity;
        } else {
          throw new Error(`Invalid test item data: price=${item.price}, quantity=${item.quantity}`);
        }
      });
      
      // Calculate subtotal
      this.subtotal = this.testItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
      
      // Calculate total amount
      this.totalAmount = this.subtotal - (this.discount || 0) + (this.tax || 0);
    } else {
      throw new Error('Test items are required');
    }
    
    next();
  } catch (error) {
    console.error('Billing pre-save middleware error:', error);
    next(error);
  }
});

// Virtual for remaining amount
billingSchema.virtual('remainingAmount').get(function() {
  return this.totalAmount - this.paidAmount;
});

// Virtual for payment percentage
billingSchema.virtual('paymentPercentage').get(function() {
  if (this.totalAmount === 0) return 0;
  return Math.round((this.paidAmount / this.totalAmount) * 100);
});

// Ensure virtual fields are serialized
billingSchema.set('toJSON', { virtuals: true });
billingSchema.set('toObject', { virtuals: true });

const Billing = mongoose.model('Billing', billingSchema);

export default Billing;
