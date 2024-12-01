import Billing from '../models/billingModel.js';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
const generateReceiptNumber = () => {
  // Get last 8 characters of UUID and convert to uppercase
  const uniqueId = uuidv4().slice(-8).toUpperCase();
  return `CHANRE${uniqueId}`;
};

// export const createBilling = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const { patientId, doctorId, billingItems, discount, payment, remarks, totals, createdBy } = req.body;
//     console.log(req.body)
//     if (!patientId || !doctorId || !billingItems || billingItems.length === 0 || !payment) {
//       return res.status(400).json({ message: 'Missing required fields' });
//     }

//     const initialReceiptNumber = generateReceiptNumber();
    
 
//     const receiptExists = await Billing.findOne({ 
//       receiptNumber: initialReceiptNumber 
//     }).session(session);

//     if (receiptExists) {
//       await session.abortTransaction();
//       return res.status(409).json({ 
//         message: 'Receipt number generation conflict. Please try again.' 
//       });
//     }

//     const initialBillingDetails = {
//       patientId,
//       doctorId,
//       billingItems,
//       discount,
//       payment,
//       remarks,
//       totals,
//       date: new Date(),
//       createdBy
//     };

//     const newBilling = new Billing({
//       ...initialBillingDetails,
//       receiptNumber: initialReceiptNumber,
//       receiptHistory: [{
//         receiptNumber: initialReceiptNumber,
//         date: new Date(),
//         billingDetails: initialBillingDetails
//       }]
//     });

//     await newBilling.save({ session });
//     await session.commitTransaction();
    
//     res.status(201).json({ 
//       message: 'Billing record created successfully', 
//       billing: newBilling 
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     console.error('Error creating billing record:', error);
//     res.status(500).json({ message: 'Server error', error });
//   } finally {
//     session.endSession();
//   }
// };


export const createBilling = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { patientId, doctorId, billingItems, discount, payment, remarks, totals } = req.body;
    
    // Get user ID from the decoded token in req.user
    const userId = req.user.id; // Make sure this matches your token payload structure
    
    if (!patientId || !doctorId || !billingItems || billingItems.length === 0 || !payment) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const initialReceiptNumber = generateReceiptNumber();
    
    const receiptExists = await Billing.findOne({ 
      receiptNumber: initialReceiptNumber 
    }).session(session);

    if (receiptExists) {
      await session.abortTransaction();
      return res.status(409).json({ 
        message: 'Receipt number generation conflict. Please try again.' 
      });
    }

    const initialBillingDetails = {
      patientId,
      doctorId,
      billingItems,
      discount,
      payment,
      remarks,
      totals,
      date: new Date(),
      createdBy: userId // Use the ID from the token
    };

    const newBilling = new Billing({
      ...initialBillingDetails,
      receiptNumber: initialReceiptNumber,
      receiptHistory: [{
        receiptNumber: initialReceiptNumber,
        date: new Date(),
        billingDetails: initialBillingDetails
      }]
    });

    await newBilling.save({ session });
    await session.commitTransaction();
    
    res.status(201).json({ 
      message: 'Billing record created successfully', 
      billing: newBilling 
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error creating billing record:', error);
    res.status(500).json({ message: 'Server error', error });
  } finally {
    session.endSession();
  }
};
export const getBillings = async (req, res) => {
  try {
    const billings = await Billing.find()
      .populate('patientId')
      .populate('doctorId', 'name').populate('createdBy', 'name');;
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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const existingBilling = await Billing.findById(id).session(session);

    if (!existingBilling) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Billing record not found' });
    }

    const newReceiptNumber = generateReceiptNumber();

    // Verify the new receipt number doesn't exist
    const receiptExists = await Billing.findOne({ 
      receiptNumber: newReceiptNumber 
    }).session(session);

    if (receiptExists) {
      await session.abortTransaction();
      return res.status(409).json({ 
        message: 'Receipt number generation conflict. Please try again.' 
      });
    }

    // Create a snapshot of the current billing state
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

    // Add the snapshot to receipt history and update the billing
    const updatedBilling = await Billing.findByIdAndUpdate(
      id,
      {
        ...req.body,
        receiptNumber: newReceiptNumber,
        $push: { receiptHistory: billingSnapshot }
      },
      { 
        new: true,
        session: session,
        runValidators: true
      }
    );

    await session.commitTransaction();

    res.status(200).json({ 
      message: 'Billing record updated successfully', 
      billing: updatedBilling 
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error updating billing record:', error);
    res.status(500).json({ message: 'Server error', error });
  } finally {
    session.endSession();
  }
};

// export const updateBillingById = async (req, res) => {

//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const { id } = req.params;
//     const existingBilling = await Billing.findById(id).session(session);

//     if (!existingBilling) {
//       await session.abortTransaction();
//       return res.status(404).json({ message: 'Billing record not found' });
//     }

  
//     const lastBilling = await Billing.findOne()
//       .sort({ receiptNumber: -1 })
//       .select('receiptNumber')
//       .session(session);

//     let newReceiptNumber = "CHANRE0000001";
//     if (lastBilling && lastBilling.receiptNumber) {
//       const lastNumber = parseInt(lastBilling.receiptNumber.replace("CHANRE", ""));
//       newReceiptNumber = `CHANRE${String(lastNumber + 1).padStart(7, '0')}`;
//     }

   
//     const receiptExists = await Billing.findOne({ 
//       receiptNumber: newReceiptNumber 
//     }).session(session);

//     if (receiptExists) {
//       await session.abortTransaction();
//       return res.status(409).json({ 
//         message: 'Receipt number generation conflict. Please try again.' 
//       });
//     }

  
//     const billingSnapshot = {
//       receiptNumber: existingBilling.receiptNumber,
//       date: new Date(),
//       billingDetails: {
//         patientId: existingBilling.patientId,
//         doctorId: existingBilling.doctorId,
//         billingItems: existingBilling.billingItems,
//         discount: existingBilling.discount,
//         payment: existingBilling.payment,
//         remarks: existingBilling.remarks,
//         totals: existingBilling.totals,
//         date: existingBilling.date
//       }
//     };


//     const updatedBilling = await Billing.findByIdAndUpdate(
//       id,
//       {
//         ...req.body,
//         receiptNumber: newReceiptNumber,
//         $push: { receiptHistory: billingSnapshot }
//       },
//       { 
//         new: true,
//         session: session,
//         runValidators: true
//       }
//     );


//     await session.commitTransaction();

//     res.status(200).json({ 
//       message: 'Billing record updated successfully', 
//       billing: updatedBilling 
//     });
//   } catch (error) {

//     await session.abortTransaction();
//     console.error('Error updating billing record:', error);
//     res.status(500).json({ message: 'Server error', error });
//   } finally {
//     session.endSession();
//   }
// };




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
