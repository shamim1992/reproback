import Billing from '../models/billingModel.js';

export const createBilling = async (req, res) => {
  try {
    const lastBilling = await Billing.findOne().sort({ createdAt: -1 });
    let initialReceiptNumber = "CHANRE0000001";
    if (lastBilling && lastBilling.receiptNumber) {
      const lastNumber = parseInt(lastBilling.receiptNumber.replace("CHANRE", ""));
      initialReceiptNumber = `CHANRE${String(lastNumber + 1).padStart(7, '0')}`;
    }


    const { patientId, doctorId, billingItems, discount, payment, remarks, totals } = req.body;
    if (!patientId ||!doctorId ||!billingItems || billingItems.length === 0 ||!payment) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const initialBillingDetails = {
      patientId,
      doctorId,
      billingItems,
      discount,
      payment,
      remarks,
      totals,
      date: new Date()
    };

    const newBilling = new Billing({
      patientId,
      doctorId,
      billingItems,
      discount,
      payment,
      remarks,
      totals,
      receiptNumber: initialReceiptNumber,  // Set the initial receipt number
      receiptHistory: [{                    // Initialize receipt history with the initial entry
        receiptNumber: initialReceiptNumber,
        date: new Date(),
        billingDetails: initialBillingDetails
      }]
    });

    await newBilling.save();
    res.status(201).json({ message: 'Billing record created successfully', billing: newBilling });
  } catch (error) {
    console.error('Error creating billing record:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};
export const getBillings = async (req, res) => {
  try {
    const billings = await Billing.find()
      .populate('patientId')
      .populate('doctorId', 'name');
    res.status(200).json(billings);
  } catch (error) {
    console.error('Error fetching billing records:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};
export const getBillingById = async (req, res) => {
  try {
    const { id } = req.params;
    const billing = await Billing.findById(id)
      .populate('patientId')
      .populate('doctorId');
    if (!billing) return res.status(404).json({ message: 'Billing record not found' });
    res.status(200).json(billing);
  } catch (error) {
    console.error('Error fetching billing record:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};
export const updateBillingById = async (req, res) => {
  try {
    const { id } = req.params;
    const existingBilling = await Billing.findById(id);

    if (!existingBilling) {
      return res.status(404).json({ message: 'Billing record not found' });
    }
    let lastNumber = 0;
    if (existingBilling.receiptNumber) {
      lastNumber = parseInt(existingBilling.receiptNumber.replace("CHANRE", ""), 10) || 0;
    }
    const newReceiptNumber = `CHANRE${String(lastNumber + 1).padStart(7, '0')}`;
    const billingSnapshot = {
      receiptNumber: existingBilling.receiptNumber,
      date: new Date(),
      billingDetails: {
        patientId: existingBilling.patientId,
        doctorId: existingBilling.doctorId,
        billingItems: existingBilling.billingItems,
        discount: existingBilling.discount,
        payment: existingBilling.payment,
        remarks: existingBilling.remarks,
        totals: existingBilling.totals,
        date: existingBilling.date
      }
    };
    existingBilling.receiptHistory.push(billingSnapshot);
    
    const updatedBilling = await Billing.findByIdAndUpdate(
      id,
      {
        ...req.body,
        receiptNumber: newReceiptNumber, 
        receiptHistory: existingBilling.receiptHistory  
      },
      { new: true }
    );

    res.status(200).json({ message: 'Billing record updated successfully', billing: updatedBilling });
  } catch (error) {
    console.error('Error updating billing record:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};
export const getBillingHistoryByReceiptNumber = async (req, res) => {
  try {
    const { id, receiptNumber } = req.params;
    const billing = await Billing.findById(id);

    if (!billing) return res.status(404).json({ message: 'Billing record not found' });

    const historyEntry = billing.receiptHistory.find(entry => entry.receiptNumber === receiptNumber);
    if (!historyEntry) return res.status(404).json({ message: 'Receipt number not found in history' });

    res.status(200).json(historyEntry.billingDetails);
  } catch (error) {
    console.error('Error fetching billing history:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};
