import TestRequest from '../models/testRequestModel.js';
import Billing from '../models/billingModel.js';

// Middleware to check if billing is completed before allowing lab operations
export const checkBillingCompleted = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Get the test request
    const testRequest = await TestRequest.findById(id);
    
    if (!testRequest) {
      return res.status(404).json({
        success: false,
        message: 'Test request not found'
      });
    }


    const allowedStatuses = ['Billing_Paid', 'Billing_Generated', 'Sample_Collection_Scheduled', 'Sample_Collection_Delayed', 'Sample_Collection_Rescheduled', 'Sample_Collected', 'Sample_Collection_Failed', 'In_Lab_Testing', 'Testing_Delayed', 'Testing_Completed', 'Report_Generated', 'Report_Sent', 'Completed'];
    
    console.log(`🔍 Billing Middleware Debug - Test Request ID: ${id}`);
    console.log(`   Current Status: ${testRequest.status}`);
    console.log(`   Billing ID: ${testRequest.billingId}`);
    
    if (!allowedStatuses.includes(testRequest.status)) {
      console.log(`   ❌ Status not allowed: ${testRequest.status}`);
      return res.status(403).json({
        success: false,
        message: 'Billing must be completed before lab operations can be performed',
        currentStatus: testRequest.status,
        requiredStatus: 'Billing_Paid or Billing_Generated (with payment)'
      });
    }

    // If status is Billing_Generated, check if there's a billing record with payment
    if (testRequest.status === 'Billing_Generated') {
      console.log(`   🔍 Checking Billing_Generated status...`);
      
      if (!testRequest.billingId) {
        console.log(`   ❌ No billing ID found`);
        return res.status(403).json({
          success: false,
          message: 'No billing record found for this test request',
          currentStatus: testRequest.status
        });
      }

      // Check if billing has any payment (partial or full)
      const billing = await Billing.findById(testRequest.billingId);
      if (!billing) {
        console.log(`   ❌ Billing record not found in database`);
        return res.status(403).json({
          success: false,
          message: 'Billing record not found',
          currentStatus: testRequest.status
        });
      }

      console.log(`   💰 Billing Details:`);
      console.log(`      Payment Status: ${billing.paymentStatus}`);
      console.log(`      Paid Amount: ₹${billing.paidAmount}`);
      console.log(`      Total Amount: ₹${billing.totalAmount}`);

      // Allow lab operations if there's any payment (partial or full)
      if (billing.paymentStatus === 'pending' || billing.paidAmount <= 0) {
        console.log(`   ❌ No payment made - blocking lab operations`);
        return res.status(403).json({
          success: false,
          message: 'Payment must be made before lab operations can be performed',
          currentStatus: testRequest.status,
          paymentStatus: billing.paymentStatus,
          paidAmount: billing.paidAmount
        });
      }
      
      console.log(`   ✅ Payment found - allowing lab operations`);
    } else {
      console.log(`   ✅ Status is Billing_Paid - allowing lab operations`);
    }

    // Add test request to request object for use in controllers
    req.testRequest = testRequest;
    next();
  } catch (error) {
    console.error('Billing middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking billing status',
      error: error.message
    });
  }
};

// Middleware to check if billing is completed OR user is superAdmin/Admin (for viewing)
export const checkBillingCompletedOrAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Allow superAdmin, Admin, and Super Consultant to bypass billing check
    if (['superAdmin', 'Admin', 'Super Consultant'].includes(req.user.role)) {
      return next();
    }
    
    // For other users, check billing status
    return checkBillingCompleted(req, res, next);
  } catch (error) {
    console.error('Billing middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking billing status',
      error: error.message
    });
  }
};

