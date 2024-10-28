// /controllers/billingController.js
import Billing from '../models/billingModel.js';

// Create a bill for a patient
export const createBill = async (req, res) => {
  const { patientId, services } = req.body;

  try {
    const totalAmount = services.reduce((total, service) => total + service.cost, 0);

    const bill = new Billing({
      patient: patientId,
      services,
      totalAmount,
      paymentStatus: 'Pending',
    });

    await bill.save();
    return res.status(201).json({ message: 'Bill created successfully', bill });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};

// Get all bills
export const getAllBills = async (req, res) => {
  try {
    const bills = await Billing.find().populate('patient');
    return res.status(200).json({ bills });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};

// Get bill by ID
export const getBillById = async (req, res) => {
  const { billId } = req.params;

  try {
    const bill = await Billing.findById(billId).populate('patient');

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    return res.status(200).json({ bill });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};

// Update bill status
export const updateBillStatus = async (req, res) => {
  const { billId } = req.params;
  const { paymentStatus } = req.body;

  try {
    const bill = await Billing.findById(billId);

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    bill.paymentStatus = paymentStatus;
    await bill.save();
    return res.status(200).json({ message: 'Bill updated successfully', bill });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};
