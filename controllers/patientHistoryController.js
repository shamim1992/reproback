import PatientHistory from '../models/patientHistoryModel.js';
import Patient from '../models/patientModel.js';
import mongoose from 'mongoose';

// @desc    Create new patient history
// @route   POST /api/patient-history
// @access  Private
export const createPatientHistory = async (req, res) => {
  console.log(req.body)
  try {
    const {
      patient,
      menarche,
      menstrualCycles,
      lmp,
      marriedInYear,
      consanguinity,
      together,
      obh,
      infertility,
      durationOfInfertility,
      priorTreatment,
      menstrualRegularity,
      menstrualPain,
      flowAmount,
      lmpSpecific,
      weight,
      weightChange,
      hirsutism,
      acne,
      galactorrhoea,
      acanthosis,
      mastalgia,
      pelvicPain,
      pelvicInfection,
      dysmenorrhea,
      pelvicSurgery,
      dyspareunia,
      cervicalSurgery,
      cervicalInfection,
      cervicalInjury,
      coitalFrequency,
      sexualDysfunction,
      medicalDisease,
      feverPast6Months,
      uti,
      std,
      epididymitis,
      testicularMaldescent,
      testicularDamage,
      varicocele,
      urogenitalSurgeries,
      habits,
      environmentalFactors,
      sexualFrequency,
      erection,
      ejaculation,
      semenAnalysis,
      pastMedical,
      pastSurgical,
      medications,
      allergies,
      familyHypertension,
      familyDiabetes,
      familyThyroid,
      familyKochs,
      familyInfertility,
      familyOthers,
      bloodGroupType,
      hemoglobin,
      bloodSugar,
      otherBloodTests,
      hiv,
      hbsag,
      vdrl,
      hormoneTests,
    } = req.body;

    // Check if patient exists
    const patientExists = await Patient.findById(patient);
    if (!patientExists) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Check if patient history already exists
    const existingHistory = await PatientHistory.findOne({ patient });
    if (existingHistory) {
      return res.status(400).json({
        success: false,
        message: 'Patient history already exists. Use update endpoint instead.'
      });
    }

    // Process semen analysis data
    const processedSemenAnalysis = semenAnalysis?.map(item => ({
      date: item.date || new Date(),
      count: item.count || '',
      motility: item.motility || '',
      morphology: item.morphology || '',
      others: item.others || ''
    })) || [];

    // Process hormone tests data
    const processedHormoneTests = hormoneTests?.map(item => ({
      date: item.date || new Date(),
      fsh: item.fsh || '',
      lh: item.lh || '',
      tsh: item.tsh || '',
      amh: item.amh || '',
      prolactin: item.prolactin || '',
      dheas: item.dheas || '',
      others: item.others || ''
    })) || [];

    const patientHistory = new PatientHistory({
      patient,
      menarche,
      menstrualCycles,
      lmp,
      marriedInYear,
      consanguinity,
      together,
      obh,
      infertility,
      durationOfInfertility,
      priorTreatment,
      menstrualRegularity,
      menstrualPain,
      flowAmount,
      lmpSpecific,
      weight,
      weightChange,
      hirsutism,
      acne,
      galactorrhoea,
      acanthosis,
      mastalgia,
      pelvicPain,
      pelvicInfection,
      dysmenorrhea,
      pelvicSurgery,
      dyspareunia,
      cervicalSurgery,
      cervicalInfection,
      cervicalInjury,
      coitalFrequency,
      sexualDysfunction,
      medicalDisease,
      feverPast6Months,
      uti,
      std,
      epididymitis,
      testicularMaldescent,
      testicularDamage,
      varicocele,
      urogenitalSurgeries,
      habits,
      environmentalFactors,
      sexualFrequency,
      erection,
      ejaculation,
      semenAnalysis: processedSemenAnalysis,
      pastMedical,
      pastSurgical,
      medications,
      allergies,
      familyHypertension,
      familyDiabetes,
      familyThyroid,
      familyKochs,
      familyInfertility,
      familyOthers,
      bloodGroupType,
      hemoglobin,
      bloodSugar,
      otherBloodTests,
      hiv,
      hbsag,
      vdrl,
      hormoneTests: processedHormoneTests,
      createdBy: req.user.id,
      center: req.user.center || patientExists.center,
    });

    const savedHistory = await patientHistory.save();
    
    // Populate patient details
    await savedHistory.populate('patient', 'name email contactNumber');
    await savedHistory.populate('createdBy', 'name username');

    res.status(201).json({
      success: true,
      message: 'Patient history created successfully',
      data: savedHistory
    });

  } catch (error) {
    console.error('Create patient history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating patient history',
      error: error.message
    });
  }
};

// @desc    Get all patient histories with pagination and filters
// @route   GET /api/patient-history
// @access  Private
export const getPatientHistories = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    let filter = {};
    
    // Filter by center for non-superAdmin users
    if (req.user.role !== 'superAdmin') {
      filter.center = req.user.center;
    }

    // Filter by patient if provided
    if (req.query.patient) {
      filter.patient = req.query.patient;
    }

    // Filter by infertility type
    if (req.query.infertility) {
      filter.infertility = req.query.infertility;
    }

    // Date range filter
    if (req.query.startDate && req.query.endDate) {
      filter.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    }

    const histories = await PatientHistory.find(filter)
      .populate('patient', 'name email contactNumber dateOfBirth gender')
      .populate('createdBy', 'name username')
      .populate('updatedBy', 'name username')
      .populate('center', 'name centerCode')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await PatientHistory.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: histories,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Get patient histories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching patient histories',
      error: error.message
    });
  }
};

// @desc    Get single patient history by ID
// @route   GET /api/patient-history/:id
// @access  Private
export const getPatientHistoryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient history ID'
      });
    }

    let filter = { _id: id };
    
    // Filter by center for non-superAdmin users
    if (req.user.role !== 'superAdmin') {
      filter.center = req.user.center;
    }

    const history = await PatientHistory.findOne(filter)
      .populate('patient', 'name email contactNumber dateOfBirth gender address occupation spouseName')
      .populate('createdBy', 'name username')
      .populate('updatedBy', 'name username')
      .populate('center', 'name centerCode address');

    if (!history) {
      return res.status(404).json({
        success: false,
        message: 'Patient history not found'
      });
    }

    res.status(200).json({
      success: true,
      data: history
    });

  } catch (error) {
    console.error('Get patient history by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching patient history',
      error: error.message
    });
  }
};

// @desc    Get patient history by patient ID
// @route   GET /api/patient-history/patient/:patientId
// @access  Private
export const getPatientHistoryByPatientId = async (req, res) => {
  try {
    const { patientId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient ID'
      });
    }

    let filter = { patient: patientId };
    
  
    const history = await PatientHistory.findOne(filter)
      .populate('patient', 'name email contactNumber dateOfBirth gender address occupation spouseName')
      .populate('createdBy', 'name username')
      .populate('updatedBy', 'name username')
      .populate('center', 'name centerCode address');

    if (!history) {
      // Return 200 with null to indicate no history available (frontend handles gracefully)
      return res.status(200).json({
        success: true,
        data: null
      });
    }
    console.log(history)

    res.status(200).json({
      success: true,
      data: history
    });

  } catch (error) {
    console.error('Get patient history by patient ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching patient history',
      error: error.message
    });
  }
};

// @desc    Update patient history
// @route   PUT /api/patient-history/:id
// @access  Private
export const updatePatientHistory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient history ID'
      });
    }

    let filter = { _id: id };
    
    // Filter by center for non-superAdmin users
    if (req.user.role !== 'superAdmin') {
      filter.center = req.user.center;
    }

    const existingHistory = await PatientHistory.findOne(filter);
    if (!existingHistory) {
      return res.status(404).json({
        success: false,
        message: 'Patient history not found'
      });
    }

    // Process semen analysis data if provided
    if (req.body.semenAnalysis) {
      req.body.semenAnalysis = req.body.semenAnalysis.map(item => ({
        date: item.date || new Date(),
        count: item.count || '',
        motility: item.motility || '',
        morphology: item.morphology || '',
        others: item.others || ''
      }));
    }

    // Process hormone tests data if provided
    if (req.body.hormoneTests) {
      req.body.hormoneTests = req.body.hormoneTests.map(item => ({
        date: item.date || new Date(),
        fsh: item.fsh || '',
        lh: item.lh || '',
        tsh: item.tsh || '',
        amh: item.amh || '',
        prolactin: item.prolactin || '',
        dheas: item.dheas || '',
        others: item.others || ''
      }));
    }

    // Add updatedBy field
    req.body.updatedBy = req.user.id;

    const updatedHistory = await PatientHistory.findByIdAndUpdate(
      id,
      req.body,
      { 
        new: true, 
        runValidators: true 
      }
    )
      .populate('patient', 'name email contactNumber dateOfBirth gender')
      .populate('createdBy', 'name username')
      .populate('updatedBy', 'name username')
      .populate('center', 'name centerCode');

    res.status(200).json({
      success: true,
      message: 'Patient history updated successfully',
      data: updatedHistory
    });

  } catch (error) {
    console.error('Update patient history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating patient history',
      error: error.message
    });
  }
};

// @desc    Add semen analysis record
// @route   POST /api/patient-history/:id/semen-analysis
// @access  Private
export const addSemenAnalysis = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, count, motility, morphology, others } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient history ID'
      });
    }

    let filter = { _id: id };
    
    // Filter by center for non-superAdmin users
    if (req.user.role !== 'superAdmin') {
      filter.center = req.user.center;
    }

    const history = await PatientHistory.findOne(filter);
    if (!history) {
      return res.status(404).json({
        success: false,
        message: 'Patient history not found'
      });
    }

    const newSemenRecord = {
      date: date || new Date(),
      count: count || '',
      motility: motility || '',
      morphology: morphology || '',
      others: others || ''
    };

    history.semenAnalysis.push(newSemenRecord);
    history.updatedBy = req.user.id;
    
    await history.save();

    res.status(200).json({
      success: true,
      message: 'Semen analysis record added successfully',
      data: history.semenAnalysis
    });

  } catch (error) {
    console.error('Add semen analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding semen analysis record',
      error: error.message
    });
  }
};

// @desc    Add hormone test record
// @route   POST /api/patient-history/:id/hormone-test
// @access  Private
export const addHormoneTest = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, fsh, lh, tsh, amh, prolactin, dheas, others } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient history ID'
      });
    }

    let filter = { _id: id };
    
    // Filter by center for non-superAdmin users
    if (req.user.role !== 'superAdmin') {
      filter.center = req.user.center;
    }

    const history = await PatientHistory.findOne(filter);
    if (!history) {
      return res.status(404).json({
        success: false,
        message: 'Patient history not found'
      });
    }

    const newHormoneRecord = {
      date: date || new Date(),
      fsh: fsh || '',
      lh: lh || '',
      tsh: tsh || '',
      amh: amh || '',
      prolactin: prolactin || '',
      dheas: dheas || '',
      others: others || ''
    };

    history.hormoneTests.push(newHormoneRecord);
    history.updatedBy = req.user.id;
    
    await history.save();

    res.status(200).json({
      success: true,
      message: 'Hormone test record added successfully',
      data: history.hormoneTests
    });

  } catch (error) {
    console.error('Add hormone test error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding hormone test record',
      error: error.message
    });
  }
};

// @desc    Delete patient history
// @route   DELETE /api/patient-history/:id
// @access  Private (Admin only)
export const deletePatientHistory = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user has permission to delete
    if (!['Admin', 'superAdmin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient history ID'
      });
    }

    let filter = { _id: id };
    
    // Filter by center for non-superAdmin users
    if (req.user.role !== 'superAdmin') {
      filter.center = req.user.center;
    }

    const history = await PatientHistory.findOne(filter);
    if (!history) {
      return res.status(404).json({
        success: false,
        message: 'Patient history not found'
      });
    }

    await PatientHistory.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Patient history deleted successfully'
    });

  } catch (error) {
    console.error('Delete patient history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting patient history',
      error: error.message
    });
  }
};