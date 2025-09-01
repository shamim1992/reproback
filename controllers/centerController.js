import Center from "../models/centerModel.js"; // Changed from 'centers' to 'Center'
import User from "../models/userModel.js";

export const createCenter = async (req, res) => {
    try {
        const { name, address, contactNumber, email, centerCode, isActive } = req.body;
        // Check if center already exists by centerCode or email
        const existingCenter = await Center.findOne({ 
            $or: [
                { centerCode: centerCode.trim() },
                { email: email.toLowerCase().trim() }
            ]
        });
        
        if (existingCenter) {
            if (existingCenter.centerCode === centerCode.trim()) {
                return res.status(400).json({ message: 'Center with this code already exists' });
            }
            if (existingCenter.email === email.toLowerCase().trim()) {
                return res.status(400).json({ message: 'Center with this email already exists' });
            }
        }

        // Validate required fields
        if (!name || !address || !contactNumber || !email || !centerCode) {
            return res.status(400).json({ message: 'All required fields must be provided' });
        }


        const newCenter = new Center({
            name: name.trim(),
            address: address.trim(),
            contactNumber: contactNumber.trim(),
            email: email.toLowerCase().trim(),
            centerCode: centerCode.trim(),
            isActive: isActive !== undefined ? isActive : true,
            createdBy: req.user.id // Make sure this matches your JWT payload structure
        });

        const savedCenter = await newCenter.save();
        
        // Populate the createdBy field for response
        await savedCenter.populate('createdBy', 'name email');
        
        res.status(201).json({
            message: 'Center created successfully',
            center: savedCenter
        });
    } catch (error) {
        console.error('Create center error:', error);
        
        // Handle mongoose validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({ message: errors.join(', ') });
        }
        
        // Handle duplicate key errors
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            return res.status(400).json({ message: `Center with this ${field} already exists` });
        }
        
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

export const getAllCenters = async (req, res) => {
    try {
        const centerList = await Center.find()
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });
        
        res.status(200).json(centerList);
    } catch (error) {
        console.error('Get all centers error:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

export const updateCenter = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, address, contactNumber, email, centerCode, isActive } = req.body;

        // Check if another center has the same centerCode or email (excluding current center)
        if (centerCode || email) {
            const existingCenter = await Center.findOne({
                _id: { $ne: id },
                $or: [
                    ...(centerCode ? [{ centerCode: centerCode.trim() }] : []),
                    ...(email ? [{ email: email.toLowerCase().trim() }] : [])
                ]
            });

            if (existingCenter) {
                if (existingCenter.centerCode === centerCode?.trim()) {
                    return res.status(400).json({ message: 'Another center with this code already exists' });
                }
                if (existingCenter.email === email?.toLowerCase().trim()) {
                    return res.status(400).json({ message: 'Another center with this email already exists' });
                }
            }
        }

        const updateData = {};
        if (name) updateData.name = name.trim();
        if (address) updateData.address = address.trim();
        if (contactNumber) updateData.contactNumber = contactNumber.trim();
        if (email) updateData.email = email.toLowerCase().trim();
        if (centerCode) updateData.centerCode = centerCode.trim();
        if (isActive !== undefined) updateData.isActive = isActive;

        const updatedCenter = await Center.findByIdAndUpdate(
            id, 
            updateData, 
            { new: true, runValidators: true }
        ).populate('createdBy', 'name email');

        if (!updatedCenter) {
            return res.status(404).json({ message: 'Center not found' });
        }

        res.status(200).json(updatedCenter);
    } catch (error) {
        console.error('Update center error:', error);
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({ message: errors.join(', ') });
        }
        
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            return res.status(400).json({ message: `Another center with this ${field} already exists` });
        }
        
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

export const deleteCenter = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedCenter = await Center.findByIdAndDelete(id);
        if (!deletedCenter) {
            return res.status(404).json({ message: 'Center not found' });
        }

        // Remove all users associated with this center
        await User.updateMany({ center: id }, { $unset: { center: "" } });

        res.status(200).json({ message: 'Center deleted successfully' });
    } catch (error) {
        console.error('Delete center error:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

export const getCenterById = async (req, res) => {
    try {
        const { id } = req.params;
        const center = await Center.findById(id)
            .populate('createdBy', 'name email');

        if (!center) {
            return res.status(404).json({ message: 'Center not found' });
        }

        res.status(200).json(center);
    } catch (error) {
        console.error('Get center by ID error:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}   

export const getCenterByCode = async (req, res) => {
    try {
        const { centerCode } = req.params;
        const center = await Center.findOne({ centerCode })
            .populate('createdBy', 'name email');

        if (!center) {
            return res.status(404).json({ message: 'Center not found' });
        }
        res.status(200).json(center);
    } catch (error) {
        console.error('Get center by code error:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

export const getCentersByUser = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).populate('center');

        if (!user || !user.center) {
            return res.status(404).json({ message: 'No center found for this user' });
        }

        res.status(200).json(user.center);
    } catch (error) {
        console.error('Get centers by user error:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

export const getActiveCenters = async (req, res) => {
    try {
        const activeCenters = await Center.find({ isActive: true })
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });

        res.status(200).json(activeCenters);
    } catch (error) {
        console.error('Get active centers error:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}
export const updateCenterStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        if (typeof isActive !== 'boolean') {
            return res.status(400).json({ message: 'isActive must be a boolean value' });
        }

        const updatedCenter = await Center.findByIdAndUpdate(
            id,
            { isActive },
            { new: true, runValidators: true }
        ).populate('createdBy', 'name email');

        if (!updatedCenter) {
            return res.status(404).json({ message: 'Center not found' });
        }

        res.status(200).json(updatedCenter);
    } catch (error) {
        console.error('Update center status error:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}
