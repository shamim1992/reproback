import TestRequest from '../models/testRequestModel.js';
import Patient from '../models/patientModel.js';
import User from '../models/userModel.js';
import Center from '../models/centerModel.js';
import fs from 'fs';
import path from 'path';

// Get test requests by doctor
export const getTestRequestsByDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    
    const testRequests = await TestRequest.find({ doctorId })
      .populate('patientId', 'firstName lastName name email phone contactNumber address uhid')
      .populate('assignedTo', 'firstName lastName name email')
      .populate('centerId', 'name centerCode')
      .populate('labReport.generatedBy', 'firstName lastName name')
      .sort({ createdAt: -1 });

    // Manually populate reviewedBy for each request that has superConsultantReview
    for (let request of testRequests) {
      if (request.superConsultantReview?.reviewedBy) {
        console.log(`Before population - Request ${request._id} reviewedBy type:`, typeof request.superConsultantReview.reviewedBy);
        console.log(`Before population - Request ${request._id} reviewedBy value:`, request.superConsultantReview.reviewedBy);
        
        // Handle both string and ObjectId types
        const reviewerId = request.superConsultantReview.reviewedBy.toString();
        console.log(`Fetching user with ID: ${reviewerId}`);
        
        // Check if the ObjectId is valid
        if (reviewerId.match(/^[0-9a-fA-F]{24}$/)) {
          const reviewer = await User.findById(reviewerId).select('firstName lastName email username role');
          console.log(`Found reviewer:`, reviewer);
          
          if (reviewer) {
            // Add a computed name field
            reviewer.name = `${reviewer.firstName || ''} ${reviewer.lastName || ''}`.trim();
            request.superConsultantReview.reviewedBy = reviewer;
            console.log(`After population - Request ${request._id} reviewedBy:`, request.superConsultantReview.reviewedBy);
          } else {
            console.log(`❌ No reviewer found for ID: ${reviewerId}`);
            console.log(`This user might have been deleted or the ID is incorrect`);
          }
        } else {
          console.log(`❌ Invalid ObjectId format: ${reviewerId}`);
        }
      }
    }

    console.log('Doctor Test Requests Query:', { doctorId });
    console.log('Doctor Test Requests Found:', testRequests.length);
    console.log('Doctor Test Requests with Reviews:', testRequests.filter(req => req.superConsultantReview?.isReviewed).length);
    
    // Debug: Check each request's superConsultantReview structure
    testRequests.forEach((request, index) => {
      console.log(`Request ${index + 1} ID: ${request._id}`);
      console.log(`Request ${index + 1} superConsultantReview:`, request.superConsultantReview);
      if (request.superConsultantReview?.reviewedBy) {
        console.log(`Request ${index + 1} reviewedBy:`, request.superConsultantReview.reviewedBy);
      }
    });

    res.status(200).json(testRequests);
  } catch (error) {
    console.error('Get test requests by doctor error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all test requests (for lab staff)
export const getAllTestRequests = async (req, res) => {
  try {
    let filter = {};
    
    // For lab staff and lab-related roles, show all requests including completed/reviewed ones for monitoring
    if (req.user.role && ['Lab Manager', 'Lab Technician', 'Lab Assistant', 'Lab Director', 'Quality Control', 'superAdmin', 'Admin'].includes(req.user.role)) {
      filter = {
        status: {
          $in: ['Billing_Paid', 'Superadmin_Approved', 'Assigned', 'Sample_Collection_Scheduled', 'Sample_Collected', 'In_Lab_Testing', 'Testing_Completed', 'Report_Generated', 'Report_Sent', 'Completed', 'Needs_Additional_Tests', 'Review_Rejected']
        }
      };
    }

    const testRequests = await TestRequest.find(filter)
      .populate('doctorId', 'firstName lastName name email')
      .populate('patientId', 'firstName lastName name email phone contactNumber address uhid')
      .populate('assignedTo', 'firstName lastName name email')
      .populate('centerId', 'name centerCode')
      .populate('labReport.generatedBy', 'firstName lastName name')
      .sort({ createdAt: -1 });


    res.status(200).json(testRequests);
  } catch (error) {
    console.error('Get all test requests error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create test request
export const createTestRequest = async (req, res) => {
  try {
    const { patientId, testTypes, priority, notes } = req.body;
    const doctorId = req.user.id;
    const centerId = req.user.centerId || null;
    
    // Debug: Log the centerId being used for test request creation
    console.log('Creating test request with centerId:', centerId);
    console.log('User centerId type:', typeof centerId);

    // Validate patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Validate test types
    if (!testTypes || testTypes.length === 0) {
      return res.status(400).json({ message: 'At least one test type is required' });
    }

    const testRequest = new TestRequest({
      doctorId,
      patientId,
      testTypes,
      priority: priority || 'Normal',
      notes: notes || '',
      centerId,
      status: 'Billing_Pending' // Start with billing pending
    });

    await testRequest.save();

    // Populate the response
    await testRequest.populate([
      { path: 'patientId', select: 'firstName lastName name email phone contactNumber address uhid' },
      { path: 'centerId', select: 'name centerCode' }
    ]);

    res.status(201).json(testRequest);
  } catch (error) {
    console.error('Create test request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update test request
export const updateTestRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const testRequest = await TestRequest.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate([
      { path: 'patientId', select: 'firstName lastName name email phone contactNumber address uhid' },
      { path: 'doctorId', select: 'firstName lastName name email' },
      { path: 'assignedTo', select: 'firstName lastName name email' },
      { path: 'centerId', select: 'name centerCode' },
      { path: 'labReport.generatedBy', select: 'firstName lastName name' }
    ]);

    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    res.status(200).json(testRequest);
  } catch (error) {
    console.error('Update test request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete test request
export const deleteTestRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const testRequest = await TestRequest.findByIdAndDelete(id);
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    res.status(200).json({ message: 'Test request deleted successfully' });
  } catch (error) {
    console.error('Delete test request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update test request status
export const updateTestRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const updateData = { status };
    if (notes) {
      updateData.notes = notes;
    }

    // Add completion date if status is completed
    if (status === 'Completed') {
      updateData.completedAt = new Date();
    }

    const testRequest = await TestRequest.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate([
      { path: 'patientId', select: 'firstName lastName name email phone contactNumber address uhid' },
      { path: 'doctorId', select: 'firstName lastName name email' },
      { path: 'assignedTo', select: 'firstName lastName name email' },
      { path: 'centerId', select: 'name centerCode' },
      { path: 'labReport.generatedBy', select: 'firstName lastName name' }
    ]);

    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    res.status(200).json(testRequest);
  } catch (error) {
    console.error('Update test request status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Upload lab report
export const uploadLabReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { testResults, notes } = req.body;

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { filename, path } = req.file;

    const testRequest = await TestRequest.findById(id);
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    // Update test request with lab report info
    testRequest.labReport = {
      fileName: filename,
      filePath: path,
      downloadUrl: `${req.protocol}://${req.get('host')}/api/test-requests/${id}/report/download`,
      generatedDate: new Date(),
      generatedBy: req.user.id
    };

    // Update test results and notes if provided
    if (testResults) {
      testRequest.labTesting = testRequest.labTesting || {};
      testRequest.labTesting.results = testResults;
    }
    if (notes) {
      testRequest.labTesting = testRequest.labTesting || {};
      testRequest.labTesting.notes = notes;
    }

    // Update status to Report_Generated
    testRequest.status = 'Report_Generated';

    await testRequest.save();

    await testRequest.populate([
      { path: 'patientId', select: 'firstName lastName name email phone contactNumber address uhid' },
      { path: 'doctorId', select: 'firstName lastName name email' },
      { path: 'assignedTo', select: 'firstName lastName name email' },
      { path: 'centerId', select: 'name centerCode' },
      { path: 'labReport.generatedBy', select: 'firstName lastName name' }
    ]);

    res.status(200).json(testRequest);
  } catch (error) {
    console.error('Upload lab report error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Download lab report
export const downloadLabReport = async (req, res) => {
  try {
    const { id } = req.params;

    const testRequest = await TestRequest.findById(id);
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    if (!testRequest.labReport || !testRequest.labReport.filePath) {
      return res.status(404).json({ message: 'Lab report not found' });
    }

    res.download(testRequest.labReport.filePath, testRequest.labReport.fileName);
  } catch (error) {
    console.error('Download lab report error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get test request by ID
export const getTestRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    const testRequest = await TestRequest.findById(id)
      .populate('patientId', 'firstName lastName name email phone contactNumber address')
      .populate('doctorId', 'firstName lastName name email')
      .populate('assignedTo', 'firstName lastName name email')
      .populate('centerId', 'name centerCode')
      .populate('labReport.generatedBy', 'firstName lastName name')
      .populate('billingId');

    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }


    // Format the data for frontend consumption
    const formattedRequest = {
      _id: testRequest._id,
      patientName: testRequest.patientId ? 
        `${testRequest.patientId.firstName || ''} ${testRequest.patientId.lastName || ''}`.trim() || 
        testRequest.patientId.name : 'Unknown Patient',
      patientPhone: testRequest.patientId?.phone || testRequest.patientId?.contactNumber || 'N/A',
      patientAddress: testRequest.patientId?.address || 'N/A',
      doctorName: testRequest.doctorId ? 
        `${testRequest.doctorId.firstName || ''} ${testRequest.doctorId.lastName || ''}`.trim() || 
        testRequest.doctorId.name : 'Unknown Doctor',
      centerName: testRequest.centerId?.name || 'N/A',
      testType: Array.isArray(testRequest.testTypes) ? testRequest.testTypes.join(', ') : testRequest.testTypes || 'N/A',
      testDescription: Array.isArray(testRequest.testTypes) ? testRequest.testTypes.join(', ') : testRequest.testTypes || 'N/A',
      status: testRequest.status || 'Pending',
      urgency: testRequest.priority || 'Normal',
      notes: testRequest.notes || '',
      createdAt: testRequest.createdAt,
      updatedAt: testRequest.updatedAt,
      completedAt: testRequest.completedAt,
      reportFilePath: testRequest.labReport?.filePath || null,
      reportFileName: testRequest.labReport?.fileName || null,
      reportGeneratedDate: testRequest.labReport?.generatedDate || null,
      reportGeneratedByName: testRequest.labReport?.generatedBy ? 
        `${testRequest.labReport.generatedBy.firstName || ''} ${testRequest.labReport.generatedBy.lastName || ''}`.trim() || 
        testRequest.labReport.generatedBy.name : null,
      // Additional fields for lab workflow
      assignedLabStaffName: testRequest.assignedTo?.name || null,
      sampleCollectorName: testRequest.sampleCollection?.collectedBy?.name || null,
      sampleCollectionScheduledDate: testRequest.sampleCollection?.scheduledDate || null,
      sampleCollectionStatus: testRequest.status === 'Sample_Collected' ? 'Collected' : 
                             testRequest.status === 'Sample_Collection_Scheduled' ? 'Scheduled' : 'Pending',
      sampleCollectionNotes: testRequest.sampleCollection?.notes || null,
      // New sample collection fields
      scheduledDate: testRequest.scheduledCollectionDate || null,
      scheduledTime: testRequest.scheduledCollectionTime || null,
      assignedCollectorName: testRequest.assignedCollectorName || null,
      collectionNotes: testRequest.collectionNotes || null,
      sampleCollectedDate: testRequest.sampleCollectedDate || null,
      sampleCollectedTime: testRequest.sampleCollectedTime || null,
      labTechnicianName: testRequest.labTesting?.testedBy?.name || null,
      testingStartDate: testRequest.labTesting?.startedDate || null,
      testingEndDate: testRequest.labTesting?.completedDate || null,
      testingNotes: testRequest.labTesting?.notes || null,
      billingInfo: testRequest.billingId ? {
        billingId: testRequest.billingId._id,
        totalAmount: testRequest.billingId.totalAmount,
        paidAmount: testRequest.billingId.paidAmount,
        remainingAmount: testRequest.billingId.remainingAmount,
        paymentStatus: testRequest.billingId.paymentStatus,
        paymentMethod: testRequest.billingId.paymentMethod,
        paymentDate: testRequest.billingId.paymentDate
      } : null
    };

    res.status(200).json(formattedRequest);
  } catch (error) {
    console.error('Get test request by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get test requests for lab staff (with formatted data)
export const getTestRequestsForLabStaff = async (req, res) => {
  try {
    console.log('getTestRequestsForLabStaff called by user:', {
      id: req.user.id,
      role: req.user.role,
      centerId: req.user.centerId
    });

    let filter = {};
    
  // Filter by center for non-superAdmin users
  if (req.user.role === 'superAdmin') {
    console.log('SuperAdmin access - showing all centers');
  } else if (req.user.centerId) {
    filter.centerId = req.user.centerId;
    console.log('Filtering by center for user role:', req.user.role, 'centerId:', req.user.centerId);
  } else {
    console.log('No centerId found for user role:', req.user.role);
  }

    console.log('Search filter:', filter);
    
    // For lab staff and admins, show all requests including completed/reviewed ones for monitoring
    // This includes requests that are ready for lab operations and those that have been reviewed/completed
    filter.status = {
      $in: ['Billing_Paid', 'Billing_Generated', 'Superadmin_Approved', 'Assigned', 'Sample_Collection_Scheduled', 'Sample_Collected', 'In_Lab_Testing', 'Testing_Completed', 'Report_Generated', 'Report_Sent', 'Completed', 'Needs_Additional_Tests', 'Review_Rejected']
    };

    const testRequests = await TestRequest.find(filter)
      .populate('doctorId', 'firstName lastName name email')
      .populate('patientId', 'firstName lastName name email phone contactNumber address uhid')
      .populate('assignedTo', 'firstName lastName name email')
      .populate('centerId', 'name centerCode')
      .populate('labReport.generatedBy', 'firstName lastName name')
      .populate('billingId')
      .sort({ createdAt: -1 });

    console.log(`Found ${testRequests.length} test requests`);

    // Filter out Billing_Generated requests that don't have proper billing/payment
    const validTestRequests = [];
    for (const request of testRequests) {
      if (request.status === 'Billing_Generated') {
        // Only include if billing exists and has payment
        if (request.billingId && request.billingId.paymentStatus !== 'pending' && request.billingId.paidAmount > 0) {
          validTestRequests.push(request);
          console.log(`✅ Including Billing_Generated request ${request._id} - has payment: ₹${request.billingId.paidAmount}`);
        } else {
          console.log(`❌ Excluding Billing_Generated request ${request._id} - no payment or billing record`);
        }
      } else {
        // Include all other statuses (Billing_Paid, etc.)
        validTestRequests.push(request);
      }
    }

    console.log(`After filtering: ${validTestRequests.length} valid test requests`);


    // Format the data for frontend consumption
    const formattedRequests = validTestRequests.map(request => ({
      _id: request._id,
      patientName: request.patientId ? 
        `${request.patientId.firstName || ''} ${request.patientId.lastName || ''}`.trim() || 
        request.patientId.name : 'Unknown Patient',
      patientPhone: request.patientId?.phone || request.patientId?.contactNumber || 'N/A',
      patientAddress: request.patientId?.address || 'N/A',
      doctorName: request.doctorId ? 
        `${request.doctorId.firstName || ''} ${request.doctorId.lastName || ''}`.trim() || 
        request.doctorId.name : 'Unknown Doctor',
      centerName: request.centerId?.name || 'N/A',
      testType: Array.isArray(request.testTypes) ? request.testTypes.join(', ') : request.testTypes || 'N/A',
      testDescription: Array.isArray(request.testTypes) ? request.testTypes.join(', ') : request.testTypes || 'N/A',
      status: request.status || 'Pending',
      urgency: request.priority || 'Normal',
      notes: request.notes || '',
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      completedAt: request.completedAt,
      reportFilePath: request.labReport?.filePath || null,
      reportFileName: request.labReport?.fileName || null,
      reportGeneratedDate: request.labReport?.generatedDate || null,
      reportGeneratedBy: request.labReport?.generatedBy?.name || null,
      billingInfo: request.billingId ? {
        billingId: request.billingId._id,
        totalAmount: request.billingId.totalAmount,
        paidAmount: request.billingId.paidAmount,
        remainingAmount: request.billingId.remainingAmount,
        paymentStatus: request.billingId.paymentStatus,
        paymentMethod: request.billingId.paymentMethod,
        paymentDate: request.billingId.paymentDate
      } : null
    }));

    res.status(200).json(formattedRequests);
  } catch (error) {
    console.error('Get test requests for lab staff error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get dashboard statistics
export const getDashboardStats = async (req, res) => {
  try {
    let baseFilter = {};
    
    // For lab staff and lab-related roles, count all requests including completed/reviewed ones for monitoring
    if (req.user.role && ['Lab Manager', 'Lab Technician', 'Lab Assistant', 'Lab Director', 'Quality Control', 'superAdmin', 'Admin'].includes(req.user.role)) {
      baseFilter = {
        status: {
          $in: ['Billing_Paid', 'Superadmin_Approved', 'Assigned', 'Sample_Collection_Scheduled', 'Sample_Collected', 'In_Lab_Testing', 'Testing_Completed', 'Report_Generated', 'Report_Sent', 'Completed', 'Needs_Additional_Tests', 'Review_Rejected']
        }
      };
    }

    // Filter by center for non-superAdmin users
    if (req.user.role === 'superAdmin') {
      console.log('SuperAdmin access - showing stats for all centers');
    } else if (req.user.centerId) {
      baseFilter.centerId = req.user.centerId;
      console.log('Filtering stats by center for user role:', req.user.role, 'centerId:', req.user.centerId);
    } else {
      console.log('No centerId found for user role:', req.user.role);
    }

    const totalRequests = await TestRequest.countDocuments(baseFilter);
    
    const pendingRequests = await TestRequest.countDocuments({
      ...baseFilter,
      status: { $in: ['Billing_Paid', 'Superadmin_Approved', 'Assigned', 'Sample_Collection_Scheduled', 'Sample_Collected', 'In_Lab_Testing', 'Testing_Completed'] }
    });
    
    const completedRequests = await TestRequest.countDocuments({
      ...baseFilter,
      status: { $in: ['Report_Generated', 'Report_Sent', 'Completed', 'Needs_Additional_Tests', 'Review_Rejected'] }
    });
    
    const urgentRequests = await TestRequest.countDocuments({
      ...baseFilter,
      priority: { $in: ['Emergency', 'Urgent'] }
    });

    res.status(200).json({
      totalRequests,
      pendingRequests,
      completedRequests,
      urgentRequests
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get test requests that need billing (for receptionists/admins)
export const getTestRequestsForBilling = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let filter = {
      status: { $in: ['Billing_Pending', 'Pending'] } // Include both statuses for now
    };

    // Filter by center for non-superAdmin users
    if (req.user.role !== 'superAdmin') {
      if (!req.user.centerId) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalRecords: 0,
            hasNext: false,
            hasPrev: false
          }
        });
      }
      filter.centerId = req.user.centerId;
    }

    const testRequests = await TestRequest.find(filter)
      .populate('patientId', 'name email contactNumber uhid')
      .populate('doctorId', 'firstName lastName')
      .populate('centerId', 'name centerCode')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await TestRequest.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: testRequests,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Get test requests for billing error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching test requests for billing',
      error: error.message
    });
  }
};

// Fix pending test requests (one-time migration)
export const fixPendingTestRequests = async (req, res) => {
  try {
    // Only allow superAdmin to run this migration
    if (req.user.role !== 'superAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Only superAdmin can run this migration'
      });
    }

    const result = await TestRequest.updateMany(
      { status: 'Pending' },
      { status: 'Billing_Pending' }
    );

    res.status(200).json({
      success: true,
      message: `Updated ${result.modifiedCount} test requests from 'Pending' to 'Billing_Pending'`,
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Fix pending test requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fixing pending test requests',
      error: error.message
    });
  }
};

// Schedule sample collection
export const scheduleSampleCollection = async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledDate, scheduledTime, assignedCollector, notes } = req.body;

    console.log('🔍 Schedule Collection Request:');
    console.log('Test Request ID:', id);
    console.log('Request body:', req.body);
    console.log('scheduledDate:', scheduledDate);
    console.log('scheduledTime:', scheduledTime);
    console.log('assignedCollector:', assignedCollector);
    console.log('notes:', notes);

    if (!scheduledDate || !scheduledTime || !assignedCollector) {
      console.log('❌ Validation failed - missing required fields');
      return res.status(400).json({ message: 'Scheduled date, time, and assigned collector are required' });
    }

    // Get collector name for display
    let assignedCollectorName = null;
    if (assignedCollector) {
      const collector = await User.findById(assignedCollector).select('firstName lastName name');
      if (collector) {
        assignedCollectorName = `${collector.firstName || ''} ${collector.lastName || ''}`.trim() || collector.name;
      }
    }

    const testRequest = await TestRequest.findByIdAndUpdate(
      id,
      {
        status: 'Sample_Collection_Scheduled',
        scheduledCollectionDate: scheduledDate,
        scheduledCollectionTime: scheduledTime,
        assignedCollector: assignedCollector,
        assignedCollectorName: assignedCollectorName,
        collectionNotes: notes || '',
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).populate([
      { path: 'patientId', select: 'firstName lastName name email phone contactNumber address uhid' },
      { path: 'doctorId', select: 'firstName lastName name email' },
      { path: 'assignedTo', select: 'firstName lastName name email' },
      { path: 'centerId', select: 'name centerCode' },
      { path: 'labReport.generatedBy', select: 'firstName lastName name' }
    ]);

    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    res.status(200).json(testRequest);
  } catch (error) {
    console.error('Schedule sample collection error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Start testing
export const startTesting = async (req, res) => {
  try {
    const { id } = req.params;
    const { labTechnicianId, notes } = req.body;

    if (!labTechnicianId) {
      return res.status(400).json({ message: 'Lab technician ID is required' });
    }

    const testRequest = await TestRequest.findByIdAndUpdate(
      id,
      {
        status: 'In_Lab_Testing',
        'labTesting.startedDate': new Date(),
        'labTesting.testedBy': labTechnicianId,
        'labTesting.notes': notes || '',
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).populate([
      { path: 'patientId', select: 'firstName lastName name email phone contactNumber address uhid' },
      { path: 'doctorId', select: 'firstName lastName name email' },
      { path: 'assignedTo', select: 'firstName lastName name email' },
      { path: 'centerId', select: 'name centerCode' },
      { path: 'labReport.generatedBy', select: 'firstName lastName name' },
      { path: 'labTesting.testedBy', select: 'firstName lastName name email' }
    ]);

    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    res.status(200).json(testRequest);
  } catch (error) {
    console.error('Start testing error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Complete testing
export const completeTesting = async (req, res) => {
  try {
    const { id } = req.params;
    const { testResults, notes, completionDate } = req.body;

    if (!testResults) {
      return res.status(400).json({ message: 'Test results are required' });
    }

    const testRequest = await TestRequest.findByIdAndUpdate(
      id,
      {
        status: 'Testing_Completed',
        testResults: testResults,
        testingNotes: notes || '',
        testingCompletedDate: completionDate || new Date(),
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).populate([
      { path: 'patientId', select: 'firstName lastName name email phone contactNumber address uhid' },
      { path: 'doctorId', select: 'firstName lastName name email' },
      { path: 'assignedTo', select: 'firstName lastName name email' },
      { path: 'centerId', select: 'name centerCode' },
      { path: 'labReport.generatedBy', select: 'firstName lastName name' }
    ]);

    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    res.status(200).json(testRequest);
  } catch (error) {
    console.error('Complete testing error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Send lab report
export const sendLabReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { sendMethod, emailSubject, emailMessage, notificationMessage } = req.body;

    if (!sendMethod) {
      return res.status(400).json({ message: 'Send method is required' });
    }

    const testRequest = await TestRequest.findById(id);
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    if (!testRequest.labReport || !testRequest.labReport.filePath) {
      return res.status(400).json({ message: 'No lab report found to send' });
    }

    // Update status to Report_Sent
    testRequest.status = 'Report_Sent';
    
    // Store communication details in notes field (since we don't have a dedicated field)
    const communicationDetails = {
      sendMethod: sendMethod,
      emailSubject: emailSubject || 'Lab Test Report',
      emailMessage: emailMessage || 'Please find your lab test report attached.',
      notificationMessage: notificationMessage || 'Your lab test report has been sent.',
      sentDate: new Date().toISOString(),
      sentBy: req.user.id
    };

    // Append to existing notes or create new notes
    const existingNotes = testRequest.notes || '';
    const newNotes = existingNotes + 
      (existingNotes ? '\n\n' : '') + 
      `Report Sent Details:\n` +
      `Method: ${sendMethod}\n` +
      `Date: ${new Date().toLocaleString()}\n` +
      `Email Subject: ${emailSubject || 'Lab Test Report'}\n` +
      `Message: ${emailMessage || 'Please find your lab test report attached.'}`;
    
    testRequest.notes = newNotes;

    await testRequest.save();

    await testRequest.populate([
      { path: 'patientId', select: 'firstName lastName name email phone contactNumber address uhid' },
      { path: 'doctorId', select: 'firstName lastName name email' },
      { path: 'assignedTo', select: 'firstName lastName name email' },
      { path: 'centerId', select: 'name centerCode' },
      { path: 'labReport.generatedBy', select: 'firstName lastName name' }
    ]);

    // TODO: Implement actual email sending and notification logic here
    // For now, we'll just update the status and return success
    
    res.status(200).json({
      message: 'Report sent successfully',
      testRequest: testRequest
    });
  } catch (error) {
    console.error('Send lab report error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


