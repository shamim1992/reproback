import express from 'express';
import mongoose from 'mongoose';
import PatientHistory from '../models/patientHistoryModel.js';
import {
  createPatientHistory,
  getPatientHistories,
  getPatientHistoryById,
  getPatientHistoryByPatientId,
  updatePatientHistory,
  addSemenAnalysis,
  addHormoneTest,
  deletePatientHistory
} from '../controllers/patientHistoryController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

// @route   POST /api/patient-history
// @desc    Create new patient history
// @access  Private (Doctor, Admin only)
router.post(
  '/',
  authorizeRoles('Doctor', 'Admin', 'superAdmin'),
  createPatientHistory
);

// @route   GET /api/patient-history
// @desc    Get all patient histories with pagination and filters
// @access  Private (All authenticated users)
router.get(
  '/',
  authorizeRoles('Doctor', 'Admin', 'Receptionist', 'Accountant', 'superAdmin', 'Super Consultant'),
  getPatientHistories
);

// @route   GET /api/patient-history/:id
// @desc    Get single patient history by ID
// @access  Private (All authenticated users)
router.get(
  '/:id',
  authorizeRoles('Doctor', 'Admin', 'Receptionist', 'Accountant', 'superAdmin', 'Super Consultant'),
  getPatientHistoryById
);

// @route   GET /api/patient-history/patient/:patientId
// @desc    Get patient history by patient ID
// @access  Private (All authenticated users)
router.get(
  '/patient/:patientId',
  authorizeRoles('Doctor', 'Admin', 'Receptionist', 'Accountant', 'superAdmin', 'Super Consultant'),
  getPatientHistoryByPatientId
);

// @route   PUT /api/patient-history/:id
// @desc    Update patient history
// @access  Private (Doctor, Admin)
router.put(
  '/:id',
  authorizeRoles('Doctor', 'Admin', 'superAdmin'),
  updatePatientHistory
);

// @route   POST /api/patient-history/:id/semen-analysis
// @desc    Add semen analysis record to patient history
// @access  Private (Doctor, Admin)
router.post(
  '/:id/semen-analysis',
  authorizeRoles('Doctor', 'Admin', 'superAdmin'),
  addSemenAnalysis
);

// @route   POST /api/patient-history/:id/hormone-test
// @desc    Add hormone test record to patient history
// @access  Private (Doctor, Admin)
router.post(
  '/:id/hormone-test',
  authorizeRoles('Doctor', 'Admin', 'superAdmin'),
  addHormoneTest
);

// @route   DELETE /api/patient-history/:id
// @desc    Delete patient history
// @access  Private (Admin, superAdmin only)
router.delete(
  '/:id',
  authorizeRoles('Admin', 'superAdmin'),
  deletePatientHistory
);

// Additional utility routes

// @route   GET /api/patient-history/center/:centerId
// @desc    Get patient histories by center ID
// @access  Private (superAdmin only)
router.get(
  '/center/:centerId',
  authorizeRoles('superAdmin'),
  async (req, res) => {
    try {
      const { centerId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      if (!mongoose.Types.ObjectId.isValid(centerId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid center ID'
        });
      }

      const histories = await PatientHistory.find({ center: centerId })
        .populate('patient', 'name email contactNumber dateOfBirth gender')
        .populate('createdBy', 'name username')
        .populate('center', 'name centerCode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await PatientHistory.countDocuments({ center: centerId });

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
      console.error('Get patient histories by center error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching patient histories',
        error: error.message
      });
    }
  }
);

// @route   GET /api/patient-history/stats/summary
// @desc    Get patient history statistics
// @access  Private (Admin, superAdmin)
router.get(
  '/stats/summary',
  authorizeRoles('Admin', 'superAdmin'),
  async (req, res) => {
    try {
      let filter = {};
      
      // Filter by center for non-superAdmin users
      if (req.user.role !== 'superAdmin') {
        filter.center = req.user.center;
      }

      // Date range filter if provided
      if (req.query.startDate && req.query.endDate) {
        filter.createdAt = {
          $gte: new Date(req.query.startDate),
          $lte: new Date(req.query.endDate)
        };
      }

      const stats = await PatientHistory.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalHistories: { $sum: 1 },
            primaryInfertility: {
              $sum: { $cond: [{ $eq: ['$infertility', 'primary'] }, 1, 0] }
            },
            secondaryInfertility: {
              $sum: { $cond: [{ $eq: ['$infertility', 'secondary'] }, 1, 0] }
            },
            avgAge: {
              $avg: {
                $divide: [
                  { $subtract: [new Date(), '$patient.dateOfBirth'] },
                  365.25 * 24 * 60 * 60 * 1000
                ]
              }
            }
          }
        }
      ]);

      // Infertility type distribution
      const infertilityDistribution = await PatientHistory.aggregate([
        { $match: filter },
        { $group: { _id: '$infertility', count: { $sum: 1 } } }
      ]);

      res.status(200).json({
        success: true,
        data: {
          summary: stats[0] || {
            totalHistories: 0,
            primaryInfertility: 0,
            secondaryInfertility: 0,
            avgAge: 0
          },
          infertilityDistribution
        }
      });

    } catch (error) {
      console.error('Get patient history stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching statistics',
        error: error.message
      });
    }
  }
);

// @route   POST /api/patient-history/bulk-import
// @desc    Bulk import patient histories (for data migration)
// @access  Private (superAdmin only)
router.post(
  '/bulk-import',
  authorizeRoles('superAdmin'),
  async (req, res) => {
    try {
      const { histories } = req.body;

      if (!Array.isArray(histories) || histories.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Histories array is required and cannot be empty'
        });
      }

      // Add createdBy to all histories
      const processedHistories = histories.map(history => ({
        ...history,
        createdBy: req.user.id
      }));

      const result = await PatientHistory.insertMany(processedHistories, {
        ordered: false, // Continue insertion even if some documents fail
        rawResult: true
      });

      res.status(201).json({
        success: true,
        message: `Successfully imported ${result.insertedCount} patient histories`,
        data: {
          inserted: result.insertedCount,
          errors: result.writeErrors || []
        }
      });

    } catch (error) {
      console.error('Bulk import error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during bulk import',
        error: error.message
      });
    }
  }
);

export default router;