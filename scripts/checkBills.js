import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Billing from '../models/billingModel.js';
import Patient from '../models/patientModel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const checkBills = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    
    const totalBills = await Billing.countDocuments();
    const recentBills = await Billing.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    
    console.log('\n📊 Database Status:');
    console.log(`   Total Bills: ${totalBills}`);
    console.log(`\n📋 Most Recent 20 Bills:`);
    
    if (recentBills.length === 0) {
      console.log('   No bills found in database!');
    } else {
      recentBills.forEach((bill, index) => {
        console.log(`   ${index + 1}. ${bill.billNumber} - ₹${bill.totalAmount.toFixed(2)} - ${bill.paymentStatus} - ${new Date(bill.createdAt).toLocaleDateString()}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

checkBills();

