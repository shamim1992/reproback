import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Patient from '../models/patientModel.js';
import Center from '../models/centerModel.js';

dotenv.config();

const updateMissingUHIDs = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find all patients without UHID
    const patientsWithoutUHID = await Patient.find({
      $or: [
        { uhid: { $exists: false } },
        { uhid: null },
        { uhid: '' }
      ]
    }).populate('center', 'centerCode');

    console.log(`\nFound ${patientsWithoutUHID.length} patients without UHID`);

    if (patientsWithoutUHID.length === 0) {
      console.log('All patients already have UHIDs!');
      process.exit(0);
    }

    // Group patients by center
    const patientsByCenter = {};
    for (const patient of patientsWithoutUHID) {
      const centerId = patient.center._id.toString();
      if (!patientsByCenter[centerId]) {
        patientsByCenter[centerId] = {
          centerCode: patient.center.centerCode,
          patients: []
        };
      }
      patientsByCenter[centerId].patients.push(patient);
    }

    // Update each patient with a UHID
    let updatedCount = 0;
    for (const centerId in patientsByCenter) {
      const { centerCode, patients } = patientsByCenter[centerId];
      
      // Get the highest serial number for this center
      const lastPatient = await Patient
        .findOne({ 
          center: centerId,
          uhid: { $exists: true, $ne: null, $ne: '' }
        })
        .sort({ uhid: -1 });

      let serialNumber = 1;
      if (lastPatient && lastPatient.uhid) {
        // Extract serial number from UHID (format: XXXX-YYYY)
        const match = lastPatient.uhid.match(/-(\d{4})$/);
        if (match) {
          serialNumber = parseInt(match[1]) + 1;
        }
      }

      console.log(`\nProcessing ${patients.length} patients for center ${centerCode}`);
      console.log(`Starting serial number: ${serialNumber}`);

      for (const patient of patients) {
        const serialStr = serialNumber.toString().padStart(4, '0');
        const uhid = `${centerCode}${serialStr}`;
        
        try {
          await Patient.findByIdAndUpdate(patient._id, { uhid });
          console.log(`✓ Updated ${patient.name}: ${uhid}`);
          updatedCount++;
          serialNumber++;
        } catch (error) {
          console.error(`✗ Failed to update ${patient.name}:`, error.message);
        }
      }
    }

    console.log(`\n✓ Successfully updated ${updatedCount} patients with UHIDs`);
    console.log('Done!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating UHIDs:', error);
    process.exit(1);
  }
};

updateMissingUHIDs();

