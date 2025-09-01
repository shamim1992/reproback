import mongoose from "mongoose";
const patientSchema = new mongoose.Schema({
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
        required: true,
        trim: true,
    },
    spouseOccupation: {
        type: String,
        required: true,
        trim: true,
    },
    spouseDateOfBirth: {
        type: Date,
        required: true,
    },

    gender: {
        type: String,
        enum: ['male', 'female', 'other'],
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
        match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit contact number'],
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
    },
    center: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Center',
        required: true,
    },
    doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
       
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },

    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
},{timestamps: true});
const Patient = mongoose.model('Patient', patientSchema);
export default Patient;