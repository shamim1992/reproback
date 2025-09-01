import mongoose from "mongoose";

const centerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Center name is required'],
        trim: true,
    },
    address: {
        type: String,
        required: [true, 'Address is required'],
        trim: true,
    },
    contactNumber: {
        type: String,
        required: [true, 'Contact number is required'],
        match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit contact number'],
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
       
       
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    centerCode: {
        type: String,
        required: [true, 'Center code is required'],
        unique: true,
        trim: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Changed from 'users' to 'User' - this should match your User model registration
        required: true,
    },
}, {
    timestamps: true,
});

// Export with singular name 'Center' instead of 'centers'
const Center = mongoose.model('Center', centerSchema);
export default Center;