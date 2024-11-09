// models/billingModel.js
import mongoose from 'mongoose';

const BillingItemSchema = new mongoose.Schema({
  name: String,
  code: String,
  category: String,
  price: Number,
  quantity: Number,
  tax: Number,
  total: Number
}, { _id: false });

const BillingSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  billingItems: [BillingItemSchema],
  discount: {
    type: { type: String, enum: ['percent', 'amount'], required: true },
    value: { type: Number, required: true }
  },
  payment: {
    type: { type: String, enum: ['cash', 'card', 'upi'], required: true },
    paid: { type: Number, required: true }
  },
  remarks: { type: String, enum: ['paid', 'pending', 'partial'], required: true },
  totals: {
    subtotal: { type: Number, required: true },
    totalTax: { type: Number, required: true },
    grandTotal: { type: Number, required: true },
    balance: { type: Number, required: true }
  },
  date: { type: Date, default: Date.now },
  receiptNumber: { type: String, unique: true },  
  receiptHistory: [{  
    receiptNumber: String,
    date: { type: Date, default: Date.now },
    billingDetails: Object
  }]
},{timestamps: true });

const Billing = mongoose.model('Billing', BillingSchema);

export default Billing;
