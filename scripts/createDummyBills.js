import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Billing from '../models/billingModel.js';
import Patient from '../models/patientModel.js';
import User from '../models/userModel.js';
import TestRequest from '../models/testRequestModel.js';
import Center from '../models/centerModel.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from parent directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const createDummyBills = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!mongoUri) {
      console.log('❌ MongoDB URI not found in environment variables');
      console.log('Please ensure MONGODB_URI or MONGO_URI is set in your .env file');
      process.exit(1);
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get existing data
    const patients = await Patient.find().limit(5);
    const doctors = await User.find({ role: 'Doctor' }).limit(3);
    const receptionists = await User.find({ role: 'Receptionist' }).limit(1);
    const centers = await Center.find().limit(1);

    if (!patients.length || !doctors.length || !receptionists.length || !centers.length) {
      console.log('❌ Missing required data. Please ensure you have patients, doctors, receptionists, and centers in the database.');
      process.exit(1);
    }

    console.log(`\n📊 Found:`);
    console.log(`   - ${patients.length} patients`);
    console.log(`   - ${doctors.length} doctors`);
    console.log(`   - ${receptionists.length} receptionists`);
    console.log(`   - ${centers.length} centers`);

    const center = centers[0];
    const receptionist = receptionists[0];

    // Test items pool
    const testItemsPool = [
      { testName: 'Complete Blood Count (CBC)', testCode: 'CBC001', price: 500, quantity: 1 },
      { testName: 'Lipid Profile', testCode: 'LP001', price: 800, quantity: 1 },
      { testName: 'Thyroid Function Test', testCode: 'TFT001', price: 1200, quantity: 1 },
      { testName: 'Liver Function Test', testCode: 'LFT001', price: 900, quantity: 1 },
      { testName: 'Kidney Function Test', testCode: 'KFT001', price: 850, quantity: 1 },
      { testName: 'Blood Sugar Fasting', testCode: 'BSF001', price: 200, quantity: 1 },
      { testName: 'HbA1c Test', testCode: 'HBA1C001', price: 600, quantity: 1 },
      { testName: 'Vitamin D Test', testCode: 'VITD001', price: 1500, quantity: 1 },
      { testName: 'Vitamin B12 Test', testCode: 'VITB12001', price: 1000, quantity: 1 },
      { testName: 'Iron Studies', testCode: 'IRON001', price: 1100, quantity: 1 },
    ];

    const paymentStatuses = ['paid', 'pending', 'partial', 'paid', 'paid']; // More paid bills
    const paymentMethods = ['cash', 'card', 'upi', 'netbanking'];

    console.log('\n🔧 Creating 10 dummy bills...\n');

    const bills = [];
    const today = new Date();

    for (let i = 0; i < 10; i++) {
      // Random selections
      const patient = patients[Math.floor(Math.random() * patients.length)];
      const doctor = doctors[Math.floor(Math.random() * doctors.length)];
      const numTests = Math.floor(Math.random() * 3) + 1; // 1-3 tests per bill
      const selectedTests = [];
      
      // Select random tests
      for (let j = 0; j < numTests; j++) {
        const test = testItemsPool[Math.floor(Math.random() * testItemsPool.length)];
        selectedTests.push({
          testName: test.testName,
          testCode: test.testCode,
          price: test.price,
          quantity: test.quantity,
          totalPrice: test.price * test.quantity
        });
      }

      const subtotal = selectedTests.reduce((sum, test) => sum + test.totalPrice, 0);
      const discount = Math.random() > 0.7 ? Math.floor(Math.random() * 200) : 0; // 30% chance of discount
      const tax = 0;
      const totalAmount = subtotal - discount + tax;
      
      const paymentStatus = paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)];
      const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
      
      let paidAmount = 0;
      let paymentHistory = [];

      if (paymentStatus === 'paid') {
        paidAmount = totalAmount;
        paymentHistory = [{
          amount: totalAmount,
          paymentMethod: paymentMethod,
          paymentDate: new Date(today.getTime() - Math.random() * 5 * 24 * 60 * 60 * 1000), // Random date within last 5 days
          processedBy: receptionist._id,
          notes: 'Full payment processed',
          receiptNumber: `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
        }];
      } else if (paymentStatus === 'partial') {
        paidAmount = Math.floor(totalAmount * (0.3 + Math.random() * 0.4)); // 30-70% paid
        paymentHistory = [{
          amount: paidAmount,
          paymentMethod: paymentMethod,
          paymentDate: new Date(today.getTime() - Math.random() * 5 * 24 * 60 * 60 * 1000),
          processedBy: receptionist._id,
          notes: 'Partial payment received',
          receiptNumber: `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
        }];
      }

      const remainingAmount = totalAmount - paidAmount;
      const paymentPercentage = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;

      // Create bill date (random within last 30 days)
      const billDate = new Date(today.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);

      // First create a test request
      const testRequest = await TestRequest.create({
        patientId: patient._id,
        doctorId: doctor._id,
        centerId: center._id,
        testTypes: selectedTests.map(t => t.testName),
        priority: 'Normal',  // Correct enum: 'Normal' not 'normal'
        status: 'Billing_Generated',  // Correct enum: 'Billing_Generated' not 'pending'
        requestDate: billDate,
        createdBy: doctor._id
      });

      // Create billing record
      const billNumber = `BILL-${billDate.getFullYear()}${String(billDate.getMonth() + 1).padStart(2, '0')}${String(billDate.getDate()).padStart(2, '0')}-${String(i + 1).padStart(4, '0')}`;
      
      const billingData = {
        testRequest: testRequest._id,
        patient: patient._id,
        doctor: doctor._id,
        center: center._id,
        billNumber: billNumber,
        testItems: selectedTests,
        subtotal: subtotal,
        discount: discount,
        tax: tax,
        totalAmount: totalAmount,
        paymentStatus: paymentStatus,
        paymentMethod: paymentMethod,
        paidAmount: paidAmount,
        remainingAmount: remainingAmount,
        paymentPercentage: paymentPercentage,
        paymentHistory: paymentHistory,
        paymentDate: paymentStatus === 'paid' ? paymentHistory[0].paymentDate : null,
        status: 'generated',
        workflow: {
          currentStage: paymentStatus === 'paid' ? 'payment' : 'billing',
          stages: [
            {
              stage: 'billing',
              status: 'completed',
              timestamp: billDate,
              updatedBy: receptionist._id,
              notes: 'Billing created'
            }
          ]
        },
        createdBy: receptionist._id,
        createdAt: billDate,
        updatedAt: billDate,
        isActive: true
      };

      if (paymentStatus === 'paid') {
        billingData.workflow.stages.push({
          stage: 'payment',
          status: 'completed',
          timestamp: paymentHistory[0].paymentDate,
          updatedBy: receptionist._id,
          notes: `Payment of ${totalAmount} processed (Receipt: ${paymentHistory[0].receiptNumber})`
        });
      }

      const bill = await Billing.create(billingData);
      bills.push(bill);

      console.log(`   ✓ Created ${billNumber}`);
      console.log(`     Patient: ${patient.name}`);
      console.log(`     Doctor: ${doctor.firstName} ${doctor.lastName}`);
      console.log(`     Amount: ₹${totalAmount.toFixed(2)}`);
      console.log(`     Status: ${paymentStatus}`);
      console.log(`     Tests: ${selectedTests.map(t => t.testName).join(', ')}`);
      console.log('');
    }

    console.log(`\n✅ Successfully created ${bills.length} dummy bills!`);
    console.log('\n📊 Summary:');
    
    const statusCounts = bills.reduce((acc, bill) => {
      acc[bill.paymentStatus] = (acc[bill.paymentStatus] || 0) + 1;
      return acc;
    }, {});

    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count} bills`);
    });

    const totalRevenue = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    const totalPaid = bills.reduce((sum, bill) => sum + bill.paidAmount, 0);

    console.log(`\n💰 Financial Summary:`);
    console.log(`   - Total Revenue: ₹${totalRevenue.toFixed(2)}`);
    console.log(`   - Total Paid: ₹${totalPaid.toFixed(2)}`);
    console.log(`   - Total Pending: ₹${(totalRevenue - totalPaid).toFixed(2)}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating dummy bills:', error);
    process.exit(1);
  }
};

createDummyBills();

