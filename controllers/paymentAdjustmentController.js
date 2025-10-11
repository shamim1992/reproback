import Billing from '../models/billingModel.js';
import ComprehensiveBilling from '../models/comprehensiveBillingModel.js';
import Center from '../models/centerModel.js';
import User from '../models/userModel.js';
import Patient from '../models/patientModel.js';

// Adjust payment for normal billing (correction for mistakes)
export const adjustBillingPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      adjustmentType, // 'increase', 'decrease', 'correct'
      adjustmentAmount,
      correctedPaidAmount,
      reason,
      notes 
    } = req.body;

    const billing = await Billing.findById(id);
    if (!billing) {
      return res.status(404).json({ 
        success: false,
        message: 'Billing record not found' 
      });
    }

    // Store original values for audit
    const originalPaidAmount = billing.paidAmount;
    const originalPaymentStatus = billing.paymentStatus;

    let newPaidAmount = originalPaidAmount;

    // Calculate new paid amount based on adjustment type
    if (adjustmentType === 'correct' && correctedPaidAmount !== undefined) {
      newPaidAmount = parseFloat(correctedPaidAmount);
    } else if (adjustmentType === 'increase') {
      newPaidAmount = originalPaidAmount + parseFloat(adjustmentAmount);
    } else if (adjustmentType === 'decrease') {
      newPaidAmount = originalPaidAmount - parseFloat(adjustmentAmount);
    }

    // Validate new amount
    if (newPaidAmount < 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Paid amount cannot be negative' 
      });
    }

    if (newPaidAmount > billing.totalAmount) {
      return res.status(400).json({ 
        success: false,
        message: 'Paid amount cannot exceed total amount' 
      });
    }

    // Update paid amount
    billing.paidAmount = newPaidAmount;

    // Update payment status based on new amount
    if (newPaidAmount === 0) {
      billing.paymentStatus = 'pending';
    } else if (newPaidAmount >= billing.totalAmount) {
      billing.paymentStatus = 'paid';
      billing.paymentDate = billing.paymentDate || new Date();
    } else {
      billing.paymentStatus = 'partial';
    }

    // Add adjustment to payment history
    billing.paymentHistory = billing.paymentHistory || [];
    const adjustmentNote = `Adjustment: ${reason}. Orig: ₹${originalPaidAmount}, New: ₹${newPaidAmount}${notes ? `. ${notes.substring(0, 50)}` : ''}`;
    billing.paymentHistory.push({
      amount: Math.abs(newPaidAmount - originalPaidAmount), // Always positive for amount field
      paymentMethod: 'adjustment',
      paymentDate: new Date(),
      processedBy: req.user.id,
      notes: adjustmentNote.substring(0, 200), // Ensure it doesn't exceed maxlength
      receiptNumber: `ADJ-${Date.now()}`
    });

    billing.updatedBy = req.user.id;
    await billing.save();

    await billing.populate([
      { path: 'patient', select: 'name email contactNumber uhid' },
      { path: 'doctor', select: 'firstName lastName' },
      { path: 'center', select: 'name centerCode' },
      { path: 'paymentHistory.processedBy', select: 'firstName lastName' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Payment adjusted successfully',
      data: billing,
      adjustment: {
        original: originalPaidAmount,
        new: newPaidAmount,
        difference: newPaidAmount - originalPaidAmount,
        previousStatus: originalPaymentStatus,
        newStatus: billing.paymentStatus
      }
    });
  } catch (error) {
    console.error('Adjust billing payment error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Adjust payment for comprehensive billing (consultation fees)
export const adjustComprehensiveBillingPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      adjustmentType, // 'increase', 'decrease', 'correct'
      adjustmentAmount,
      correctedPaidAmount,
      reason,
      notes 
    } = req.body;

    const billing = await ComprehensiveBilling.findById(id);
    if (!billing) {
      return res.status(404).json({ 
        success: false,
        message: 'Billing record not found' 
      });
    }

    // Store original values for audit
    const originalPaidAmount = billing.paidAmount;
    const originalStatus = billing.status;

    let newPaidAmount = originalPaidAmount;

    // Calculate new paid amount based on adjustment type
    if (adjustmentType === 'correct' && correctedPaidAmount !== undefined) {
      newPaidAmount = parseFloat(correctedPaidAmount);
    } else if (adjustmentType === 'increase') {
      newPaidAmount = originalPaidAmount + parseFloat(adjustmentAmount);
    } else if (adjustmentType === 'decrease') {
      newPaidAmount = originalPaidAmount - parseFloat(adjustmentAmount);
    }

    // Validate new amount
    if (newPaidAmount < 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Paid amount cannot be negative' 
      });
    }

    if (newPaidAmount > billing.totalAmount) {
      return res.status(400).json({ 
        success: false,
        message: 'Paid amount cannot exceed total amount' 
      });
    }

    // Update paid amount
    billing.paidAmount = newPaidAmount;

    // Update status based on new amount
    if (newPaidAmount === 0) {
      billing.status = 'pending';
    } else if (newPaidAmount >= billing.totalAmount) {
      billing.status = 'paid';
      billing.paymentDate = billing.paymentDate || new Date();
    } else {
      billing.status = 'partial';
    }

    // Add adjustment to payment history
    billing.paymentHistory = billing.paymentHistory || [];
    const adjustmentNote = `Adjustment: ${reason}. Orig: ₹${originalPaidAmount}, New: ₹${newPaidAmount}${notes ? `. ${notes.substring(0, 50)}` : ''}`;
    billing.paymentHistory.push({
      amount: Math.abs(newPaidAmount - originalPaidAmount), // Always positive for amount field
      paymentMethod: 'adjustment',
      paymentDate: new Date(),
      processedBy: req.user.id,
      notes: adjustmentNote.substring(0, 200), // Ensure it doesn't exceed maxlength
      receiptNumber: `ADJ-${Date.now()}`
    });

    billing.updatedBy = req.user.id;
    await billing.save();

    await billing.populate([
      { path: 'patient', select: 'name email contactNumber uhid' },
      { path: 'doctor', select: 'firstName lastName' },
      { path: 'center', select: 'name centerCode' },
      { path: 'paymentHistory.processedBy', select: 'firstName lastName' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Payment adjusted successfully',
      data: billing,
      adjustment: {
        original: originalPaidAmount,
        new: newPaidAmount,
        difference: newPaidAmount - originalPaidAmount,
        previousStatus: originalStatus,
        newStatus: billing.status
      }
    });
  } catch (error) {
    console.error('Adjust comprehensive billing payment error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
};

