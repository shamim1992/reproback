import mongoose from 'mongoose';
const billingSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient', 
      required: true,
    },
    services: [
      {
        description: {
          type: String,
          required: true,
        },
        cost: {
          type: Number,
          required: true,
        },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['Paid', 'Pending'],
      default: 'Pending',
    },
  },
  { timestamps: true }
);

const Billing = mongoose.model('Billing', billingSchema);

export default Billing;
