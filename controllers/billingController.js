import Billing from '../models/billingModel.js';
import Counter from '../models/counterModel.js';
import Receipt from '../models/receiptModel.js';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// Generate receipt number
const generateReceiptNumber = () => {
  const uniqueId = uuidv4().slice(-8).toUpperCase();
  return `REC${uniqueId}`;
};

// Fixed bill number generation function
export const generateBillNumber = async (session = null) => {
  const baseNumber = 100000000; // Base number for all approaches
  
  try {
    // Method 1: Direct MongoDB collection operation
    const db = mongoose.connection.db;
    const result = await db.collection('counters').findOneAndUpdate(
      { id: 'billNumber' },
      { $inc: { sequenceValue: 1 } },
      {
        upsert: true,
        returnDocument: 'after',
        ...(session && { session })
      }
    );

    if (result && result.value) {
      const finalNumber = baseNumber + result.value.sequenceValue;
      return finalNumber.toString().padStart(9, '0');
    }
  } catch (error) {
    console.warn('Direct counter approach failed:', error.message);
  }

  try {
    // Method 2: Counter model approach
    const counter = await Counter.findOneAndUpdate(
      { id: 'billNumber' },
      { $inc: { sequenceValue: 1 } },
      { 
        new: true, 
        upsert: true,
        ...(session && { session })
      }
    );

    if (counter) {
      const finalNumber = baseNumber + counter.sequenceValue;
      return finalNumber.toString().padStart(9, '0');
    }
  } catch (error) {
    console.warn('Counter model approach failed:', error.message);
  }

  // Method 3: Fallback - find highest existing bill number
  try {
    const highestBill = await Billing.findOne({ 
      billNumber: { $exists: true, $ne: null, $ne: '' }
    })
    .sort({ billNumber: -1 })
    .session(session);

    let nextNumber = baseNumber + 1; // 100000001
    
    if (highestBill && highestBill.billNumber) {
      const currentNumber = parseInt(highestBill.billNumber);
      nextNumber = currentNumber + 1;
    }

    return nextNumber.toString().padStart(9, '0');
  } catch (error) {
    console.error('All bill number generation methods failed:', error);
    throw new Error('Unable to generate bill number');
  }
};

// Create receipt for tracking changes
const createReceipt = async (receiptData, session) => {
  const receiptNumber = generateReceiptNumber();
  const receipt = new Receipt({
    receiptNumber,
    ...receiptData
  });
  await receipt.save({ session });
  return receipt;
};

// Fixed createBilling function with better error handling
export const createBilling = async (req, res) => {
  console.log('🆕 Creating new billing record...');
  
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    console.log('✅ Transaction started');

    const { patientId, doctorId, billingItems, discount, payment, totals } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!patientId || !doctorId || !billingItems || billingItems.length === 0 || !payment) {
      console.error('❌ Missing required fields:', { patientId, doctorId, billingItems: billingItems?.length, payment });
      await session.abortTransaction();
      return res.status(400).json({ 
        message: 'Missing required fields',
        missingFields: {
          patientId: !patientId,
          doctorId: !doctorId,
          billingItems: !billingItems || billingItems.length === 0,
          payment: !payment
        }
      });
    }

    console.log('✅ Required fields validated');

    // Generate bill number with retry logic
    let billNumber;
    let attempts = 0;
    const maxAttempts = 5; // Increased from 3
    
    do {
      try {
        console.log(`🔢 Generating bill number (attempt ${attempts + 1}/${maxAttempts})`);
        billNumber = await generateBillNumber(session);
        console.log(`✅ Generated bill number: ${billNumber}`);
        attempts++;
        
        // Check if bill number already exists
        const existingBill = await Billing.findOne({ billNumber }).session(session);
        if (!existingBill) {
          console.log('✅ Bill number is unique');
          break; // Unique bill number found
        }
        
        console.warn(`⚠️ Bill number ${billNumber} already exists, retrying...`);
        
        if (attempts >= maxAttempts) {
          throw new Error('Unable to generate unique bill number after maximum attempts');
        }
      } catch (error) {
        console.error(`❌ Error generating bill number on attempt ${attempts + 1}:`, error.message);
        if (attempts >= maxAttempts - 1) {
          throw error;
        }
      }
    } while (attempts < maxAttempts);

    console.log(`✅ Final bill number: ${billNumber}`);

    // Calculate due amount and status
    const dueAmount = totals.grandTotal - payment.paid;
    const status = dueAmount <= 0 ? 'paid' : dueAmount < totals.grandTotal ? 'partial' : 'active';

    console.log('💰 Calculated billing details:', {
      grandTotal: totals.grandTotal,
      paid: payment.paid,
      dueAmount,
      status
    });

    // Create new billing record
    const newBilling = new Billing({
      billNumber,
      patientId,
      doctorId,
      billingItems,
      discount,
      payment,
      status,
      totals: {
        ...totals,
        balance: dueAmount,
        dueAmount: Math.max(0, dueAmount)
      },
      createdBy: userId
    });

    console.log('💾 Saving billing record...');
    await newBilling.save({ session });
    console.log('✅ Billing record saved');

    // Create creation receipt
    console.log('🧾 Creating receipt...');
    await createReceipt({
      billNumber,
      billingId: newBilling._id,
      type: 'creation',
      amount: payment.paid,
      paymentMethod: {
        type: payment.type,
        cardNumber: payment.cardNumber,
        utrNumber: payment.utrNumber
      },
      newStatus: status,
      remarks: 'Bill created',
      createdBy: userId
    }, session);
    console.log('✅ Receipt created');

    await session.commitTransaction();
    console.log('🎉 Transaction committed successfully');
    
    res.status(201).json({ 
      message: 'Billing record created successfully', 
      billing: newBilling,
      success: true
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('❌ Error creating billing record:', error);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({ 
      message: 'Server error creating billing record', 
      error: error.message || 'Unknown error occurred',
      success: false
    });
  } finally {
    session.endSession();
    console.log('🔌 Session ended');
  }
};

// Initialize counter if it doesn't exist (helper function)
export const initializeBillCounter = async () => {
  try {
    console.log('🔧 Checking bill counter...');
    
    const existingCounter = await Counter.findOne({ id: 'billNumber' });
    
    if (!existingCounter) {
      console.log('🆕 Creating new bill counter...');
      
      // Find highest existing bill number
      const highestBill = await Billing.findOne({ 
        billNumber: { $exists: true, $ne: null, $ne: '' }
      }).sort({ billNumber: -1 });

      let startingValue = 0;
      if (highestBill && highestBill.billNumber) {
        const currentNumber = parseInt(highestBill.billNumber);
        startingValue = currentNumber - 100000000;
        console.log(`📈 Found highest bill: ${highestBill.billNumber}, starting counter at: ${startingValue}`);
      }

      await Counter.create({
        id: 'billNumber',
        sequenceValue: startingValue
      });
      
      console.log('✅ Bill counter created successfully');
    } else {
      console.log(`✅ Bill counter exists with value: ${existingCounter.sequenceValue}`);
    }
  } catch (error) {
    console.error('❌ Error initializing bill counter:', error);
    throw error;
  }
};

// Test bill number generation (for debugging)
export const testBillNumberGeneration = async (req, res) => {
  try {
    console.log('🧪 Testing bill number generation...');
    
    // Initialize counter first
    await initializeBillCounter();
    
    // Generate a test bill number
    const billNumber = await generateBillNumber();
    
    res.status(200).json({
      message: 'Bill number generation test successful',
      billNumber,
      success: true
    });
  } catch (error) {
    console.error('❌ Bill number generation test failed:', error);
    res.status(500).json({
      message: 'Bill number generation test failed',
      error: error.message,
      success: false
    });
  }
};

// Migration function to add billNumber to existing bills
export const migrateBillNumbers = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const billsWithoutNumber = await Billing.find({ 
      $or: [
        { billNumber: { $exists: false } },
        { billNumber: null },
        { billNumber: '' }
      ]
    }).session(session);

    let migrated = 0;
    
    for (const bill of billsWithoutNumber) {
      let billNumber;
      let attempts = 0;
      const maxAttempts = 3;
      
      // Generate unique bill number for each bill
      do {
        billNumber = await generateBillNumber(session);
        attempts++;
        
        // Check if this bill number is already assigned
        const existingBill = await Billing.findOne({ 
          billNumber,
          _id: { $ne: bill._id } // Exclude current bill
        }).session(session);
        
        if (!existingBill) {
          break; // Unique bill number found
        }
        
        if (attempts >= maxAttempts) {
          throw new Error(`Failed to generate unique bill number for bill ${bill._id}`);
        }
      } while (attempts < maxAttempts);

      await Billing.findByIdAndUpdate(
        bill._id,
        { billNumber },
        { session }
      );
      
      migrated++;
    }

    await session.commitTransaction();
    res.status(200).json({ 
      message: `Successfully migrated ${migrated} bills with bill numbers`,
      migratedCount: migrated,
      success: true
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error migrating bill numbers:', error);
    res.status(500).json({ 
      message: 'Server error during migration', 
      error: error.message || error,
      success: false 
    });
  } finally {
    session.endSession();
  }
};

// ... (rest of your existing functions remain the same)
// Update billing record
export const updateBillingById = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updateData = req.body;
    
    const existingBilling = await Billing.findById(id).session(session);
    if (!existingBilling) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Billing record not found' });
    }

    // Store previous data for receipt
    const previousData = existingBilling.toObject();
    
    // Update billing
    const updatedBilling = await Billing.findByIdAndUpdate(
      id,
      updateData,
      { new: true, session, runValidators: true }
    );

    // Create modification receipt
    await createReceipt({
      billNumber: existingBilling.billNumber,
      billingId: existingBilling._id,
      type: 'modification',
      previousStatus: existingBilling.status,
      newStatus: updatedBilling.status,
      changes: {
        previousData,
        newData: updatedBilling.toObject(),
        description: 'Bill modified'
      },
      remarks: 'Bill updated',
      createdBy: userId
    }, session);

    await session.commitTransaction();

    res.status(200).json({ 
      message: 'Billing record updated successfully', 
      billing: updatedBilling,
      success: true
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error updating billing record:', error);
    res.status(500).json({ message: 'Server error', error });
  } finally {
    session.endSession();
  }
};

// Add payment to existing bill
export const addPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { amount, paymentMethod } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid payment amount' });
    }

    const billing = await Billing.findById(id).session(session);
    if (!billing) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Billing record not found' });
    }

    if (billing.status === 'cancelled') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Cannot add payment to cancelled bill' });
    }

    const previousStatus = billing.status;
    const newPaidAmount = billing.payment.paid + amount;
    const newDueAmount = billing.totals.grandTotal - newPaidAmount;
    
    let newStatus;
    if (newDueAmount <= 0) {
      newStatus = 'paid';
    } else if (newPaidAmount > 0) {
      newStatus = 'partial';
    } else {
      newStatus = 'active';
    }

    // Update billing
    const updatedBilling = await Billing.findByIdAndUpdate(
      id,
      {
        'payment.paid': newPaidAmount,
        'totals.balance': Math.max(0, newDueAmount),
        'totals.dueAmount': Math.max(0, newDueAmount),
        status: newStatus
      },
      { new: true, session }
    );

    // Create payment receipt
    await createReceipt({
      billNumber: billing.billNumber,
      billingId: billing._id,
      type: 'payment',
      amount,
      paymentMethod,
      previousStatus,
      newStatus,
      remarks: `Payment of ${amount} received`,
      createdBy: userId
    }, session);

    await session.commitTransaction();

    res.status(200).json({ 
      message: 'Payment added successfully', 
      billing: updatedBilling,
      success: true
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error adding payment:', error);
    res.status(500).json({ message: 'Server error', error });
  } finally {
    session.endSession();
  }
};

export const cancelBill = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    const billing = await Billing.findById(id).session(session);
    if (!billing) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Billing record not found' });
    }

    if (billing.status === 'cancelled') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Bill is already cancelled' });
    }

    // Check if bill can be cancelled (same day only)
    const billDate = new Date(billing.date);
    const today = new Date();
    
    // Set time to 00:00:00 for accurate date comparison
    const billDateOnly = new Date(billDate.getFullYear(), billDate.getMonth(), billDate.getDate());
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    if (billDateOnly.getTime() !== todayDateOnly.getTime()) {
      await session.abortTransaction();
      return res.status(400).json({ 
        message: 'Bill can only be cancelled on the same day it was created',
        billDate: billDate.toDateString(),
        currentDate: today.toDateString(),
        error: 'CANCELLATION_TIME_EXPIRED'
      });
    }

    const previousStatus = billing.status;
    
    // Update billing status
    const updatedBilling = await Billing.findByIdAndUpdate(
      id,
      { status: 'cancelled' },
      { new: true, session }
    );

    // Create cancellation receipt with original payment amount and method
    await createReceipt({
      billNumber: billing.billNumber,
      billingId: billing._id,
      type: 'cancellation',
      amount: billing.payment.paid,
      paymentMethod: {
        type: billing.payment.type,
        cardNumber: billing.payment.cardNumber,
        utrNumber: billing.payment.utrNumber
      },
      previousStatus,
      newStatus: 'cancelled',
      remarks: reason || 'Bill cancelled - Refund processed',
      createdBy: userId
    }, session);

    await session.commitTransaction();

    res.status(200).json({ 
      message: 'Bill cancelled successfully', 
      billing: updatedBilling,
      refundAmount: billing.payment.paid,
      success: true
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error cancelling bill:', error);
    res.status(500).json({ message: 'Server error', error });
  } finally {
    session.endSession();
  }
};

// Get all billings
export const getBillings = async (req, res) => {
  try {
    const billings = await Billing.find()
      .populate('patientId')
      .populate('doctorId')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json(billings);
  } catch (error) {
    console.error('Error fetching billing records:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

// Get billing by ID
export const getBillingById = async (req, res) => {
  try {
    const { id } = req.params;
    const billing = await Billing.findById(id)
      .populate('patientId')
      .populate('doctorId')
      .populate('createdBy', 'name');
    
    if (!billing) {
      return res.status(404).json({ message: 'Billing record not found' });
    }
    
    res.status(200).json(billing);
  } catch (error) {
    console.error('Error fetching billing record:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

// Get billing by bill number
export const getBillingByBillNumber = async (req, res) => {
  try {
    const { billNumber } = req.params;
    const billing = await Billing.findOne({ billNumber })
      .populate('patientId')
      .populate('doctorId')
      .populate('createdBy', 'name');
    
    if (!billing) {
      return res.status(404).json({ message: 'Billing record not found' });
    }
    
    res.status(200).json(billing);
  } catch (error) {
    console.error('Error fetching billing record:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getDueAmountReport = async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    
    let matchConditions = {
      'totals.dueAmount': { $gt: 0 }
    };

    if (status) {
      matchConditions.status = status;
    }

    if (startDate && endDate) {
      matchConditions.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const dueReport = await Billing.aggregate([
      { $match: matchConditions },
      {
        $lookup: {
          from: 'patients',
          localField: 'patientId',
          foreignField: '_id',
          as: 'patient'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'doctorId',
          foreignField: '_id',
          as: 'doctor'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'billedBy'
        }
      },
      {
        $project: {
          billNumber: 1,
          // Patient details
          patientName: { 
            $concat: [
              { $ifNull: [{ $arrayElemAt: ['$patient.firstName', 0] }, ''] },
              ' ',
              { $ifNull: [{ $arrayElemAt: ['$patient.lastName', 0] }, ''] }
            ]
          },
          patientId: { $arrayElemAt: ['$patient.patientId', 0] },
          mobileNumber: { $arrayElemAt: ['$patient.mobileNumber', 0] },
          // Doctor details
          doctorName: { $arrayElemAt: ['$doctor.name', 0] },
          // Billing details
          grandTotal: '$totals.grandTotal',
          paidAmount: '$payment.paid',
          dueAmount: '$totals.dueAmount',
          status: 1,
          date: 1,
          // Created by details
          billedBy: { $arrayElemAt: ['$billedBy.name', 0] },
          createdBy: { $arrayElemAt: ['$billedBy.name', 0] },
          // Additional fields
          remarks: 1,
          createdAt: 1
        }
      },
      { $sort: { date: -1 } }
    ]);

    // Calculate totals
    const totalDue = dueReport.reduce((sum, bill) => sum + (bill.dueAmount || 0), 0);
    const totalBills = dueReport.length;
    const totalBillAmount = dueReport.reduce((sum, bill) => sum + (bill.grandTotal || 0), 0);
    const totalPaidAmount = dueReport.reduce((sum, bill) => sum + (bill.paidAmount || 0), 0);

    res.status(200).json({
      summary: {
        totalDueAmount: totalDue,
        totalBillsWithDue: totalBills,
        totalBillAmount: totalBillAmount,
        totalPaidAmount: totalPaidAmount
      },
      bills: dueReport
    });
  } catch (error) {
    console.error('Error generating due amount report:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};