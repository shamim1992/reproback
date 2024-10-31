// controllers/billingController.js
import Billing from '../models/billingModel.js';

// Create a new billing record
export const createBilling = async (req, res) => {
  try {
    const { patientId, doctorId, billingItems, discount, payment, remarks, totals } = req.body;

    const newBilling = new Billing({
      patientId,
      doctorId,
      billingItems,
      discount,
      payment,
      remarks,
      totals
    });

    await newBilling.save();
    res.status(201).json({ message: 'Billing record created successfully', billing: newBilling });
  } catch (error) {
    console.error('Error creating billing record:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

// Get all billing records
export const getBillings = async (req, res) => {
  try {
    const billings = await Billing.find()
      .populate('patientId', 'firstName lastName')
      .populate('doctorId', 'name');
    res.status(200).json(billings);
  } catch (error) {
    console.error('Error fetching billing records:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

// Get a single billing record by ID
export const getBillingById = async (req, res) => {
  try {
    const { id } = req.params;
    const billing = await Billing.findById(id)
      .populate('patientId', 'firstName lastName')
      .populate('doctorId', 'name');
    if (!billing) return res.status(404).json({ message: 'Billing record not found' });
    res.status(200).json(billing);
  } catch (error) {
    console.error('Error fetching billing record:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};
