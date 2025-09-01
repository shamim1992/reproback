import mongoose from "mongoose";

// Schema for semen analysis records
const semenAnalysisSchema = new mongoose.Schema({
  date: {
    type: Date,
 
  },
  count: {
    type: String,
    trim: true,
  },
  motility: {
    type: String,
    trim: true,
  },
  morphology: {
    type: String,
    trim: true,
  },
  others: {
    type: String,
    trim: true,
  },
}, { _id: false });

// Schema for hormone test records
const hormoneTestSchema = new mongoose.Schema({
  date: {
    type: Date,
 
  },
  fsh: {
    type: String,
    trim: true,
  },
  lh: {
    type: String,
    trim: true,
  },
  tsh: {
    type: String,
    trim: true,
  },
  amh: {
    type: String,
    trim: true,
  },
  prolactin: {
    type: String,
    trim: true,
  },
  dheas: {
    type: String,
    trim: true,
  },
  others: {
    type: String,
    trim: true,
  },
}, { _id: false });

const patientHistorySchema = new mongoose.Schema({
  // Reference to patient
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
 
  },

  // Patient Personal Information
  menarche: {
    type: String,
 
    trim: true,
  },
  menstrualCycles: {
    type: String,
 
    trim: true,
  },
  lmp: {
    type: String,
 
    trim: true,
  },
  marriedInYear: {
    type: String,
 
    trim: true,
  },
  consanguinity: {
    type: String,
 
    trim: true,
  },
  together: {
    type: String,
 
    trim: true,
  },
  obh: {
    type: String,
 
    trim: true,
  },
  infertility: {
    type: String,
    enum: ['primary', 'secondary'],
 
  },
  durationOfInfertility: {
    type: String,
 
    trim: true,
  },
  priorTreatment: {
    type: String,
 
    trim: true,
  },

  // Menstrual Factors
  menstrualRegularity: {
    type: String,
    enum: ['regular', 'irregular'],
 
  },
  menstrualPain: {
    type: String,
    enum: ['painful', 'painless'],
 
  },
  flowAmount: {
    type: String,
    enum: ['scanty', 'moderate', 'profuse'],
 
  },
  lmpSpecific: {
    type: String,
 
    trim: true,
  },

  // Hormonal Factors
  weight: {
    type: String,
 
    trim: true,
  },
  weightChange: {
    type: String,
    enum: ['gain', 'loss', 'nil'],
 
  },
  hirsutism: {
    type: String,
    enum: ['yes', 'no'],
 
  },
  acne: {
    type: String,
    enum: ['yes', 'no'],
 
  },
  galactorrhoea: {
    type: String,
    enum: ['yes', 'no'],
 
  },
  acanthosis: {
    type: String,
    enum: ['yes', 'no'],
 
  },
  mastalgia: {
    type: String,
    enum: ['yes', 'no'],
 
  },

  // Pelvis/Tubal/Uterine Factors
  pelvicPain: {
    type: String,
    enum: ['yes', 'no'],
 
  },
  pelvicInfection: {
    type: String,
    enum: ['yes', 'no'],
 
  },
  dysmenorrhea: {
    type: String,
    enum: ['yes', 'no'],
 
  },
  pelvicSurgery: {
    type: String,
    enum: ['yes', 'no'],
 
  },
  dyspareunia: {
    type: String,
    enum: ['yes', 'no'],
 
  },

  // Cervical Factors
  cervicalSurgery: {
    type: String,
    trim: true,
  },
  cervicalInfection: {
    type: String,
    trim: true,
  },
  cervicalInjury: {
    type: String,
    trim: true,
  },

  // Coital Factors
  coitalFrequency: {
    type: String,
    trim: true,
  },
  sexualDysfunction: {
    type: String,
    trim: true,
  },

  // Male Factors
  medicalDisease: {
    type: String,
    trim: true,
  },
  feverPast6Months: {
    type: String,
    trim: true,
  },
  uti: {
    type: String,
    trim: true,
  },
  std: {
    type: String,
    trim: true,
  },
  epididymitis: {
    type: String,
    trim: true,
  },
  testicularMaldescent: {
    type: String,
    trim: true,
  },
  testicularDamage: {
    type: String,
    trim: true,
  },
  varicocele: {
    type: String,
    trim: true,
  },
  urogenitalSurgeries: {
    type: String,
    trim: true,
  },
  habits: {
    type: String,
    trim: true,
  },
  environmentalFactors: {
    type: String,
    trim: true,
  },
  sexualFrequency: {
    type: String,
    trim: true,
  },
  erection: {
    type: String,
    trim: true,
  },
  ejaculation: {
    type: String,
    trim: true,
  },

  // Semen Analysis - Array of test records
  semenAnalysis: [semenAnalysisSchema],

  // Past History
  pastMedical: {
    type: String,
    trim: true,
  },
  pastSurgical: {
    type: String,
    trim: true,
  },
  medications: {
    type: String,
    trim: true,
  },
  allergies: {
    type: String,
    trim: true,
  },

  // Family History
  familyHypertension: {
    type: String,
    trim: true,
  },
  familyDiabetes: {
    type: String,
    trim: true,
  },
  familyThyroid: {
    type: String,
    trim: true,
  },
  familyKochs: {
    type: String,
    trim: true,
  },
  familyInfertility: {
    type: String,
    trim: true,
  },
  familyOthers: {
    type: String,
    trim: true,
  },

  // Routine Blood Tests
  bloodGroupType: {
    type: String,
    trim: true,
  },
  hemoglobin: {
    type: String,
    trim: true,
  },
  bloodSugar: {
    type: String,
    trim: true,
  },
  otherBloodTests: {
    type: String,
    trim: true,
  },
  hiv: {
    type: String,
    trim: true,
  },
  hbsag: {
    type: String,
    trim: true,
  },
  vdrl: {
    type: String,
    trim: true,
  },

  // Hormone Tests - Array of test records
  hormoneTests: [hormoneTestSchema],

  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
 
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  center: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center',
 
  },
}, {
  timestamps: true,
});

// Index for efficient queries
patientHistorySchema.index({ patient: 1 });
patientHistorySchema.index({ center: 1 });
patientHistorySchema.index({ createdAt: -1 });

// Virtual for patient details
patientHistorySchema.virtual('patientDetails', {
  ref: 'Patient',
  localField: 'patient',
  foreignField: '_id',
  justOne: true,
});

// Ensure virtual fields are serialized
patientHistorySchema.set('toJSON', { virtuals: true });
patientHistorySchema.set('toObject', { virtuals: true });

const PatientHistory = mongoose.model('PatientHistory', patientHistorySchema);

export default PatientHistory;