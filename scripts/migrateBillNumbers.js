import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Billing from '../models/billingModel.js';
import Receipt from '../models/receiptModel.js';
import Counter from '../models/counterModel.js';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

// Generate receipt number
const generateReceiptNumber = () => {
  const uniqueId = uuidv4().slice(-8).toUpperCase();
  return `REC${uniqueId}`;
};

// Enhanced bill number generation without transaction dependency
const generateBillNumber = async () => {
  try {
    // Method 1: Use Counter model (most reliable)
    const counter = await Counter.findOneAndUpdate(
      { id: 'billNumber' },
      { $inc: { sequenceValue: 1 } },
      { 
        new: true, 
        upsert: true
      }
    );

    if (counter) {
      const baseNumber = 100000000;
      const finalNumber = baseNumber + counter.sequenceValue;
      return finalNumber.toString().padStart(9, '0');
    }
  } catch (error) {
    console.warn('Counter approach failed:', error.message);
  }

  // Method 2: Fallback - find highest existing bill number and increment
  try {
    const highestBill = await Billing.findOne({ 
      billNumber: { $exists: true, $ne: null, $ne: '' }
    }).sort({ billNumber: -1 });

    let nextNumber = 100000001;
    
    if (highestBill && highestBill.billNumber) {
      const currentNumber = parseInt(highestBill.billNumber);
      nextNumber = currentNumber + 1;
    }

    return nextNumber.toString().padStart(9, '0');
  } catch (error) {
    console.error('Fallback bill number generation failed:', error);
    throw new Error('Unable to generate bill number');
  }
};

// Create receipt for migrated bill
const createReceiptForBill = async (bill, billNumber, session) => {
  try {
    // Check if a creation receipt already exists for this bill
    const existingReceipt = await Receipt.findOne({
      billingId: bill._id,
      type: 'creation'
    }).session(session);

    if (existingReceipt) {
      console.log(`   📄 Creation receipt already exists for bill ${bill._id}`);
      
      // Update the existing receipt's bill number if it's different
      if (existingReceipt.billNumber !== billNumber) {
        await Receipt.findByIdAndUpdate(
          existingReceipt._id,
          { billNumber },
          { session }
        );
        console.log(`   📝 Updated existing receipt ${existingReceipt.receiptNumber} with new bill number`);
      }
      return existingReceipt;
    }

    // Generate unique receipt number
    let receiptNumber;
    let receiptAttempts = 0;
    const maxReceiptAttempts = 5;

    do {
      receiptNumber = generateReceiptNumber();
      receiptAttempts++;

      const existingReceiptWithNumber = await Receipt.findOne({
        receiptNumber
      }).session(session);

      if (!existingReceiptWithNumber) {
        break; // Unique receipt number found
      }

      if (receiptAttempts >= maxReceiptAttempts) {
        throw new Error(`Failed to generate unique receipt number after ${maxReceiptAttempts} attempts`);
      }
    } while (receiptAttempts < maxReceiptAttempts);

    // Create new receipt
    const receipt = new Receipt({
      receiptNumber,
      billNumber,
      billingId: bill._id,
      type: 'creation',
      amount: bill.payment?.paid || 0,
      paymentMethod: {
        type: bill.payment?.type || 'cash',
        cardNumber: bill.payment?.cardNumber,
        utrNumber: bill.payment?.utrNumber
      },
      newStatus: bill.status,
      remarks: 'Bill created - Generated during migration',
      createdBy: bill.createdBy,
      date: bill.date || bill.createdAt || new Date()
    });

    await receipt.save({ session });
    console.log(`   📄 Created receipt ${receiptNumber} for bill ${billNumber}`);
    
    return receipt;
  } catch (error) {
    console.error(`   ❌ Failed to create receipt for bill ${bill._id}:`, error.message);
    throw error;
  }
};

// Process bills in smaller batches with individual transactions
const migrateBillNumbersBatch = async (bills, batchNumber, totalBatches) => {
  console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${bills.length} bills)`);
  
  let batchMigrated = 0;
  let batchFailed = 0;
  let receiptsCreated = 0;
  let receiptsUpdated = 0;
  const batchFailedBills = [];

  for (let i = 0; i < bills.length; i++) {
    const bill = bills[i];
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      // Generate bill number OUTSIDE of transaction first
      let billNumber;
      let attempts = 0;
      const maxAttempts = 5;

      do {
        billNumber = await generateBillNumber();
        attempts++;

        // Check uniqueness within transaction
        const existingBill = await Billing.findOne({
          billNumber,
          _id: { $ne: bill._id }
        }).session(session);

        if (!existingBill) {
          break; // Unique bill number found
        }

        if (attempts >= maxAttempts) {
          throw new Error(`Failed to generate unique bill number after ${maxAttempts} attempts`);
        }
      } while (attempts < maxAttempts);

      // Update the bill with the new bill number
      await Billing.findByIdAndUpdate(
        bill._id,
        { billNumber },
        { session }
      );

      // Create or update receipt for this bill
      const receipt = await createReceiptForBill(bill, billNumber, session);
      
      if (receipt.isNew !== false) {
        receiptsCreated++;
      } else {
        receiptsUpdated++;
      }

      // Update other related receipts with the new bill number
      const receiptUpdateResult = await Receipt.updateMany(
        { 
          billingId: bill._id,
          _id: { $ne: receipt._id } // Exclude the creation receipt we just handled
        },
        { $set: { billNumber } },
        { session }
      );

      await session.commitTransaction();
      
      console.log(`✔ [${i + 1}/${bills.length}] Updated bill ${bill._id} → ${billNumber} (${receiptUpdateResult.modifiedCount + 1} receipts updated)`);
      batchMigrated++;

    } catch (error) {
      await session.abortTransaction();
      console.error(`❌ [${i + 1}/${bills.length}] Failed to migrate bill ${bill._id}:`, error.message);
      batchFailed++;
      batchFailedBills.push({
        billId: bill._id,
        error: error.message
      });
    } finally {
      await session.endSession();
    }
  }

  return { 
    batchMigrated, 
    batchFailed, 
    batchFailedBills, 
    receiptsCreated, 
    receiptsUpdated 
  };
};

const migrateBillNumbers = async () => {
  console.log('🚀 Starting bill number migration with receipt creation...');
  
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Initialize counter if it doesn't exist
    await initializeCounter();

    // Find bills that don't have bill numbers
    const billsWithoutNumber = await Billing.find({
      $or: [
        { billNumber: { $exists: false } },
        { billNumber: null },
        { billNumber: '' }
      ]
    });

    console.log(`📊 Found ${billsWithoutNumber.length} bills without bill numbers`);

    if (billsWithoutNumber.length === 0) {
      console.log('✅ All bills already have bill numbers. Nothing to migrate.');
      return;
    }

    // Process in batches of 50 to avoid overwhelming the system
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < billsWithoutNumber.length; i += batchSize) {
      batches.push(billsWithoutNumber.slice(i, i + batchSize));
    }

    console.log(`📊 Processing ${batches.length} batches of ${batchSize} bills each`);

    let totalMigrated = 0;
    let totalFailed = 0;
    let totalReceiptsCreated = 0;
    let totalReceiptsUpdated = 0;
    const allFailedBills = [];

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const result = await migrateBillNumbersBatch(batch, batchIndex + 1, batches.length);
      
      totalMigrated += result.batchMigrated;
      totalFailed += result.batchFailed;
      totalReceiptsCreated += result.receiptsCreated;
      totalReceiptsUpdated += result.receiptsUpdated;
      allFailedBills.push(...result.batchFailedBills);

      // Small delay between batches to avoid overwhelming the database
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`\n🎉 Migration completed!`);
    console.log(`✅ Successfully migrated: ${totalMigrated} bills`);
    console.log(`📄 Receipts created: ${totalReceiptsCreated}`);
    console.log(`📝 Receipts updated: ${totalReceiptsUpdated}`);
    
    if (totalFailed > 0) {
      console.log(`❌ Failed to migrate: ${totalFailed} bills`);
      console.log('\n📋 Failed bills summary:');
      allFailedBills.forEach((failedBill, index) => {
        console.log(`${index + 1}. ${failedBill.billId}: ${failedBill.error}`);
      });
      
      // Write failed bills to a file for manual review
      const fs = await import('fs');
      const failedBillsFile = `failed_bills_${new Date().toISOString().split('T')[0]}.json`;
      fs.writeFileSync(failedBillsFile, JSON.stringify(allFailedBills, null, 2));
      console.log(`📄 Failed bills details saved to: ${failedBillsFile}`);
    }

    // Final verification
    await verifyMigration();

  } catch (error) {
    console.error('❌ Migration failed with error:', error);
    process.exit(1);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Verify migration results
const verifyMigration = async () => {
  try {
    console.log('\n🔍 Verifying migration results...');
    
    // Check bills without bill numbers
    const billsWithoutNumber = await Billing.countDocuments({
      $or: [
        { billNumber: { $exists: false } },
        { billNumber: null },
        { billNumber: '' }
      ]
    });

    // Check bills without creation receipts
    const billsWithoutReceipts = await Billing.aggregate([
      {
        $lookup: {
          from: 'receipts',
          let: { billId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$billingId', '$$billId'] },
                    { $eq: ['$type', 'creation'] }
                  ]
                }
              }
            }
          ],
          as: 'creationReceipts'
        }
      },
      {
        $match: {
          creationReceipts: { $size: 0 }
        }
      },
      {
        $count: 'billsWithoutCreationReceipts'
      }
    ]);

    const billsWithoutCreationReceipts = billsWithoutReceipts[0]?.billsWithoutCreationReceipts || 0;

    console.log(`📊 Verification Results:`);
    console.log(`   - Bills without bill numbers: ${billsWithoutNumber}`);
    console.log(`   - Bills without creation receipts: ${billsWithoutCreationReceipts}`);
    
    if (billsWithoutNumber === 0 && billsWithoutCreationReceipts === 0) {
      console.log('✅ Migration verification passed!');
    } else {
      console.log('⚠️ Migration verification found issues - may need manual review');
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
};

// Initialize counter collection
const initializeCounter = async () => {
  try {
    console.log('🔧 Initializing counter...');
    
    // Check if counter already exists
    const existingCounter = await Counter.findOne({ id: 'billNumber' });
    
    if (!existingCounter) {
      // Find the highest existing bill number to start from
      const highestBill = await Billing.findOne({ 
        billNumber: { $exists: true, $ne: null, $ne: '' }
      }).sort({ billNumber: -1 });

      let startingValue = 0;
      if (highestBill && highestBill.billNumber) {
        const currentNumber = parseInt(highestBill.billNumber);
        startingValue = currentNumber - 100000000;
        console.log(`📈 Found highest bill number: ${highestBill.billNumber}, starting counter at: ${startingValue}`);
      }

      await Counter.create({
        id: 'billNumber',
        sequenceValue: startingValue
      });
      
      console.log('✅ Counter initialized successfully');
    } else {
      console.log(`✅ Counter already exists with value: ${existingCounter.sequenceValue}`);
    }
  } catch (error) {
    console.warn('⚠️ Counter initialization failed, will use fallback:', error.message);
  }
};

// Add some validation before starting migration
const validateMigration = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Check if we have the required collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    if (!collectionNames.includes('billings')) {
      throw new Error('Billings collection not found');
    }
    
    if (!collectionNames.includes('receipts')) {
      console.warn('⚠️ Receipts collection not found - will be created automatically');
    }
    
    if (!collectionNames.includes('counters')) {
      console.warn('⚠️ Counters collection not found - will be created automatically');
    }
    
    await mongoose.disconnect();
    return true;
  } catch (error) {
    console.error('❌ Validation failed:', error);
    return false;
  }
};

// Add a function to create receipts for existing bills (without bill number changes)
const createMissingReceipts = async () => {
  console.log('🔍 Checking for bills without creation receipts...');
  
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Find bills that don't have creation receipts
    const billsWithoutReceipts = await Billing.aggregate([
      {
        $lookup: {
          from: 'receipts',
          let: { billId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$billingId', '$$billId'] },
                    { $eq: ['$type', 'creation'] }
                  ]
                }
              }
            }
          ],
          as: 'creationReceipts'
        }
      },
      {
        $match: {
          creationReceipts: { $size: 0 },
          billNumber: { $exists: true, $ne: null, $ne: '' }
        }
      }
    ]);

    console.log(`📊 Found ${billsWithoutReceipts.length} bills without creation receipts`);

    if (billsWithoutReceipts.length === 0) {
      console.log('✅ All bills have creation receipts');
      return;
    }

    let receiptsCreated = 0;
    let receiptsFailed = 0;

    for (const bill of billsWithoutReceipts) {
      const session = await mongoose.startSession();
      
      try {
        session.startTransaction();
        
        await createReceiptForBill(bill, bill.billNumber, session);
        await session.commitTransaction();
        
        receiptsCreated++;
        console.log(`✔ Created receipt for bill ${bill.billNumber}`);
        
      } catch (error) {
        await session.abortTransaction();
        receiptsFailed++;
        console.error(`❌ Failed to create receipt for bill ${bill._id}:`, error.message);
      } finally {
        await session.endSession();
      }
    }

    console.log(`\n📄 Receipt creation completed:`);
    console.log(`✅ Created: ${receiptsCreated} receipts`);
    console.log(`❌ Failed: ${receiptsFailed} receipts`);

  } catch (error) {
    console.error('❌ Create missing receipts failed:', error);
  } finally {
    await mongoose.disconnect();
  }
};

// Main execution
const main = async () => {
  console.log('🔍 Validating migration prerequisites...');
  
  const isValid = await validateMigration();
  if (!isValid) {
    process.exit(1);
  }
  
  console.log('✅ Validation passed');
  
  // Check command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--receipts-only')) {
    await createMissingReceipts();
  } else {
    await migrateBillNumbers();
  }
};

// Run the migration
main().catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});