import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Billing from '../models/billingModel.js';
import ComprehensiveBilling from '../models/comprehensiveBillingModel.js';

// Load environment variables
dotenv.config();

// Get billing ID from command line argument
const billingId = process.argv[2];

if (!billingId) {
  console.error('Usage: node scripts/checkBillingRecord.js <billingId>');
  process.exit(1);
}

const checkBillingRecord = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/repro', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Connected to MongoDB');
    console.log('Checking billing ID:', billingId);
    console.log('='.repeat(60));

    // Check if it's a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(billingId)) {
      console.error('❌ Invalid ObjectId format');
      process.exit(1);
    }

    // Check regular billing
    console.log('\n🔍 Checking Regular Billing...');
    const regularBilling = await Billing.findById(billingId)
      .populate('patient', 'name email contactNumber')
      .populate('doctor', 'firstName lastName')
      .populate('center', 'name centerCode')
      .populate('createdBy', 'firstName lastName');

    if (regularBilling) {
      console.log('✅ Found in Regular Billing');
      console.log('Bill Number:', regularBilling.billNumber);
      console.log('Status:', regularBilling.status);
      console.log('Payment Status:', regularBilling.paymentStatus);
      console.log('Is Active:', regularBilling.isActive);
      console.log('Total Amount:', regularBilling.totalAmount);
      console.log('Paid Amount:', regularBilling.paidAmount);
      console.log('Center:', regularBilling.center?.name, '(ID:', regularBilling.center?._id, ')');
      console.log('Patient:', regularBilling.patient?.name);
      console.log('Doctor:', regularBilling.doctor?.firstName, regularBilling.doctor?.lastName);
      console.log('Created By:', regularBilling.createdBy?.firstName, regularBilling.createdBy?.lastName);
      console.log('Created At:', regularBilling.createdAt);
      console.log('Updated At:', regularBilling.updatedAt);
      console.log('\nFull Record:');
      console.log(JSON.stringify(regularBilling, null, 2));
    } else {
      console.log('❌ Not found in Regular Billing');
    }

    // Check comprehensive billing
    console.log('\n🔍 Checking Comprehensive Billing...');
    const comprehensiveBilling = await ComprehensiveBilling.findById(billingId)
      .populate('patient', 'name email contactNumber')
      .populate('doctor', 'firstName lastName')
      .populate('center', 'name centerCode')
      .populate('createdBy', 'firstName lastName');

    if (comprehensiveBilling) {
      console.log('✅ Found in Comprehensive Billing');
      console.log('Bill Number:', comprehensiveBilling.billNumber);
      console.log('Status:', comprehensiveBilling.status);
      console.log('Payment Status:', comprehensiveBilling.paymentStatus);
      console.log('Is Active:', comprehensiveBilling.isActive);
      console.log('Total Amount:', comprehensiveBilling.totalAmount);
      console.log('Paid Amount:', comprehensiveBilling.paidAmount);
      console.log('Center:', comprehensiveBilling.center?.name, '(ID:', comprehensiveBilling.center?._id, ')');
      console.log('Patient:', comprehensiveBilling.patient?.name);
      console.log('Doctor:', comprehensiveBilling.doctor?.firstName, comprehensiveBilling.doctor?.lastName);
      console.log('Created By:', comprehensiveBilling.createdBy?.firstName, comprehensiveBilling.createdBy?.lastName);
      console.log('Workflow Stage:', comprehensiveBilling.workflow?.currentStage);
      console.log('Preview Invoice Approved:', comprehensiveBilling.previewInvoice?.isApproved);
      console.log('Created At:', comprehensiveBilling.createdAt);
      console.log('Updated At:', comprehensiveBilling.updatedAt);
      console.log('\nFull Record:');
      console.log(JSON.stringify(comprehensiveBilling, null, 2));
    } else {
      console.log('❌ Not found in Comprehensive Billing');
    }

    console.log('\n' + '='.repeat(60));
    
    if (!regularBilling && !comprehensiveBilling) {
      console.log('❌ Billing record not found in either collection');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error checking billing record:', error);
    process.exit(1);
  }
};

checkBillingRecord();

