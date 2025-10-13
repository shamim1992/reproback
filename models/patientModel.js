import mongoose from "mongoose";
const patientSchema = new mongoose.Schema(
  {
    uhid: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },
    
    name: {
      type: String,
      required: true,
      trim: true,
    },

    dateOfBirth: {
      type: Date,
      required: true,
    },
    occupation: {
      type: String,
      required: true,
      trim: true,
    },
    spouseName: {
      type: String,

      trim: true,
    },
    spouseOccupation: {
      type: String,

      trim: true,
    },
    spouseDateOfBirth: {
      type: Date,
    },

    gender: {
      type: String,
      enum: ["male", "female", "other"],
      required: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    contactNumber: {
      type: String,
      required: true,
      match: [/^[0-9]{10}$/, "Please enter a valid 10-digit contact number"],
    },
    email: {
      type: String,
      required: false, // Email is now optional
      unique: true,
      sparse: true, // Allow multiple null/undefined emails
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    center: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Center",
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Track if patient has been billed before (for registration fee logic)
    hasBeenBilled: {
      type: Boolean,
      default: false,
    },

    // Track first billing date
    firstBillingDate: {
      type: Date,
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual field to calculate age from dateOfBirth
patientSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

const Patient = mongoose.model("Patient", patientSchema);
export default Patient;
