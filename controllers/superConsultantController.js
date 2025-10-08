import TestRequest from '../models/testRequestModel.js';
import Patient from '../models/patientModel.js';
import User from '../models/userModel.js';
import Center from '../models/centerModel.js';
import PatientHistory from '../models/patientHistoryModel.js';

// Get all test requests with lab reports for super consultant review
export const getTestRequestsForReview = async (req, res) => {
  try {
    const testRequests = await TestRequest.find({
      'labReport.filePath': { $exists: true }
    })
      .populate('doctorId', 'firstName lastName name email')
      .populate('patientId', 'firstName lastName name email phone contactNumber address dateOfBirth gender')
      .populate('assignedTo', 'firstName lastName name email')
      .populate('centerId', 'name centerCode')
      .populate('labReport.generatedBy', 'firstName lastName name')
      .populate('labTesting.testedBy', 'firstName lastName name email')
      .populate('superConsultantReview.reviewedBy', 'firstName lastName name')
      .sort({ createdAt: -1 });

    console.log('Super Consultant - Found test requests:', testRequests.length);
    console.log('Super Consultant - Test requests:', testRequests.map(tr => ({
      id: tr._id,
      status: tr.status,
      hasLabReport: !!tr.labReport?.filePath,
      patientName: tr.patientId?.name || tr.patientId?.firstName,
      patientId: tr.patientId?._id || tr.patientId,
      labTechnician: tr.labTesting?.testedBy?.firstName
    })));
    console.log('Super Consultant - UPDATED CONTROLLER VERSION - Lab technician data should be included');

    // Format the data for frontend consumption
    const formattedRequests = testRequests.map(request => ({
      _id: request._id,
      patientId: request.patientId?._id || request.patientId,
      patientName: request.patientId ? 
        `${request.patientId.firstName || ''} ${request.patientId.lastName || ''}`.trim() || 
        request.patientId.name : 'Unknown Patient',
      patientPhone: request.patientId?.phone || request.patientId?.contactNumber || 'N/A',
      patientAddress: request.patientId?.address || 'N/A',
      patientAge: request.patientId?.dateOfBirth ? 
        Math.floor((new Date() - new Date(request.patientId.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000)) : 'N/A',
      patientGender: request.patientId?.gender || 'N/A',
      doctorName: request.doctorId ? 
        `${request.doctorId.firstName || ''} ${request.doctorId.lastName || ''}`.trim() || 
        request.doctorId.name : 'Unknown Doctor',
      doctorEmail: request.doctorId?.email || 'N/A',
      centerName: request.centerId?.name || 'N/A',
      testType: Array.isArray(request.testTypes) ? request.testTypes.join(', ') : request.testTypes || 'N/A',
      status: request.status || 'Pending',
      urgency: request.priority || 'Normal',
      notes: request.notes || '',
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      reportFilePath: request.labReport?.filePath || null,
      reportFileName: request.labReport?.fileName || null,
      reportGeneratedDate: request.labReport?.generatedDate || null,
      reportGeneratedBy: request.labReport?.generatedBy ? 
        `${request.labReport.generatedBy.firstName || ''} ${request.labReport.generatedBy.lastName || ''}`.trim() || 
        request.labReport.generatedBy.name : null,
      // Super consultant review data
      isReviewed: request.superConsultantReview?.isReviewed || false,
      reviewStatus: request.superConsultantReview?.status || 'Pending',
      reviewDate: request.superConsultantReview?.reviewDate || null,
      reviewerName: request.superConsultantReview?.reviewedBy ? 
        `${request.superConsultantReview.reviewedBy.firstName || ''} ${request.superConsultantReview.reviewedBy.lastName || ''}`.trim() || 
        request.superConsultantReview.reviewedBy.name : null,
      feedback: request.superConsultantReview?.feedback || null,
      additionalTestsRequired: request.superConsultantReview?.additionalTestsRequired || [],
      recommendations: request.superConsultantReview?.recommendations || null
    }));

    res.status(200).json(formattedRequests);
  } catch (error) {
    console.error('Get test requests for review error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get test request details for review
export const getTestRequestForReview = async (req, res) => {
  try {
    const { id } = req.params;

    const testRequest = await TestRequest.findById(id)
      .populate('doctorId', 'firstName lastName name email phone')
      .populate('patientId', 'firstName lastName name email phone contactNumber address dateOfBirth gender occupation spouseName spouseOccupation')
      .populate('assignedTo', 'firstName lastName name email')
      .populate('centerId', 'name centerCode address contactNumber email')
      .populate('labReport.generatedBy', 'firstName lastName name email')
      .populate('labTesting.testedBy', 'firstName lastName name email')
      .populate('superConsultantReview.reviewedBy', 'firstName lastName name email');

    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    if (!testRequest.labReport || !testRequest.labReport.filePath) {
      return res.status(400).json({ message: 'No lab report available for review' });
    }

    // Format the data for frontend consumption
    const formattedRequest = {
      _id: testRequest._id,
      patientName: testRequest.patientId ? 
        `${testRequest.patientId.firstName || ''} ${testRequest.patientId.lastName || ''}`.trim() || 
        testRequest.patientId.name : 'Unknown Patient',
      patientPhone: testRequest.patientId?.phone || testRequest.patientId?.contactNumber || 'N/A',
      patientAddress: testRequest.patientId?.address || 'N/A',
      patientEmail: testRequest.patientId?.email || 'N/A',
      patientAge: testRequest.patientId?.dateOfBirth ? 
        Math.floor((new Date() - new Date(testRequest.patientId.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000)) : 'N/A',
      patientGender: testRequest.patientId?.gender || 'N/A',
      patientOccupation: testRequest.patientId?.occupation || 'N/A',
      spouseName: testRequest.patientId?.spouseName || 'N/A',
      spouseOccupation: testRequest.patientId?.spouseOccupation || 'N/A',
      doctorName: testRequest.doctorId ? 
        `${testRequest.doctorId.firstName || ''} ${testRequest.doctorId.lastName || ''}`.trim() || 
        testRequest.doctorId.name : 'Unknown Doctor',
      doctorEmail: testRequest.doctorId?.email || 'N/A',
      doctorPhone: testRequest.doctorId?.phone || 'N/A',
      centerName: testRequest.centerId?.name || 'N/A',
      centerAddress: testRequest.centerId?.address || 'N/A',
      centerPhone: testRequest.centerId?.contactNumber || 'N/A',
      centerEmail: testRequest.centerId?.email || 'N/A',
      testType: Array.isArray(testRequest.testTypes) ? testRequest.testTypes.join(', ') : testRequest.testTypes || 'N/A',
      status: testRequest.status || 'Pending',
      urgency: testRequest.priority || 'Normal',
      notes: testRequest.notes || '',
      createdAt: testRequest.createdAt,
      updatedAt: testRequest.updatedAt,
      reportFilePath: testRequest.labReport?.filePath || null,
      reportFileName: testRequest.labReport?.fileName || null,
      reportGeneratedDate: testRequest.labReport?.generatedDate || null,
      reportGeneratedBy: testRequest.labReport?.generatedBy ? 
        `${testRequest.labReport.generatedBy.firstName || ''} ${testRequest.labReport.generatedBy.lastName || ''}`.trim() || 
        testRequest.labReport.generatedBy.name : null,
      reportGeneratedByEmail: testRequest.labReport?.generatedBy?.email || 'N/A',
      // Lab testing details
      labTestingResults: testRequest.labTesting?.results || null,
      labTestingNotes: testRequest.labTesting?.notes || null,
      labTestingStartDate: testRequest.labTesting?.startedDate || null,
      labTestingCompletedDate: testRequest.labTesting?.completedDate || null,
      labTechnicianName: testRequest.labTesting?.testedBy ? 
        `${testRequest.labTesting.testedBy.firstName || ''} ${testRequest.labTesting.testedBy.lastName || ''}`.trim() || 
        testRequest.labTesting.testedBy.name || 'Lab Technician' : 'Lab Technician',
      // Super consultant review data
      isReviewed: testRequest.superConsultantReview?.isReviewed || false,
      reviewStatus: testRequest.superConsultantReview?.status || 'Pending',
      reviewDate: testRequest.superConsultantReview?.reviewDate || null,
      reviewerName: testRequest.superConsultantReview?.reviewedBy ? 
        `${testRequest.superConsultantReview.reviewedBy.firstName || ''} ${testRequest.superConsultantReview.reviewedBy.lastName || ''}`.trim() || 
        testRequest.superConsultantReview.reviewedBy.name : null,
      reviewerEmail: testRequest.superConsultantReview?.reviewedBy?.email || 'N/A',
      feedback: testRequest.superConsultantReview?.feedback || null,
      additionalTestsRequired: testRequest.superConsultantReview?.additionalTestsRequired || [],
      recommendations: testRequest.superConsultantReview?.recommendations || null
    };

    res.status(200).json(formattedRequest);
  } catch (error) {
    console.error('Get test request for review error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Submit super consultant review
export const submitSuperConsultantReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { feedback, additionalTestsRequired, recommendations, status } = req.body;

    console.log('Submit Super Consultant Review - Request received:', {
      id,
      feedback: feedback ? 'Present' : 'Missing',
      status,
      additionalTestsRequired,
      recommendations: recommendations ? 'Present' : 'Missing',
      userId: req.user?.id,
      userRole: req.user?.role
    });

    if (!feedback || !status) {
      console.log('Submit Super Consultant Review - Validation failed:', {
        hasFeedback: !!feedback,
        hasStatus: !!status
      });
      return res.status(400).json({ message: 'Feedback and status are required' });
    }

    console.log('Submit Super Consultant Review - Searching for test request:', id);
    const testRequest = await TestRequest.findById(id);
    if (!testRequest) {
      console.log('Submit Super Consultant Review - Test request not found:', id);
      return res.status(404).json({ message: 'Test request not found' });
    }

    console.log('Submit Super Consultant Review - Test request found:', {
      id: testRequest._id,
      hasLabReport: !!testRequest.labReport,
      hasFilePath: !!testRequest.labReport?.filePath,
      currentStatus: testRequest.status
    });

    if (!testRequest.labReport || !testRequest.labReport.filePath) {
      console.log('Submit Super Consultant Review - No lab report available');
      return res.status(400).json({ message: 'No lab report available for review' });
    }

    // Update super consultant review
    console.log('Submit Super Consultant Review - Updating review data:', {
      reviewedBy: req.user.id,
      status,
      feedbackLength: feedback?.length || 0,
      additionalTestsCount: additionalTestsRequired?.length || 0
    });

    testRequest.superConsultantReview = {
      reviewedBy: req.user.id,
      reviewDate: new Date(),
      feedback: feedback,
      additionalTestsRequired: additionalTestsRequired || [],
      recommendations: recommendations || '',
      status: status,
      isReviewed: true
    };

    // Update test request status based on review
    const oldStatus = testRequest.status;
    if (status === 'Needs_Additional_Tests') {
      testRequest.status = 'Needs_Additional_Tests';
    } else if (status === 'Approved') {
      testRequest.status = 'Completed';
    } else if (status === 'Rejected') {
      testRequest.status = 'Review_Rejected';
    }

    console.log('Submit Super Consultant Review - Status update:', {
      oldStatus,
      newStatus: testRequest.status,
      reviewStatus: status
    });

    console.log('Submit Super Consultant Review - Attempting to save...');
    await testRequest.save();
    console.log('Submit Super Consultant Review - Save successful');

    // Populate the response
    console.log('Submit Super Consultant Review - Populating response...');
    await testRequest.populate([
      { path: 'patientId', select: 'firstName lastName name email phone contactNumber address dateOfBirth gender' },
      { path: 'doctorId', select: 'firstName lastName name email phone' },
      { path: 'assignedTo', select: 'firstName lastName name email' },
      { path: 'centerId', select: 'name centerCode' },
      { path: 'labReport.generatedBy', select: 'firstName lastName name email' },
      { path: 'superConsultantReview.reviewedBy', select: 'firstName lastName name email' }
    ]);
    console.log('Submit Super Consultant Review - Population successful');

    console.log('Submit Super Consultant Review - Sending success response');
    res.status(200).json({
      message: 'Review submitted successfully',
      testRequest: testRequest
    });
  } catch (error) {
    console.error('Submit super consultant review error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get dashboard statistics for super consultant
export const getSuperConsultantDashboardStats = async (req, res) => {
  try {
    const totalReports = await TestRequest.countDocuments({
      'labReport.filePath': { $exists: true }
    });
    
    console.log('Super Consultant Dashboard Stats - Total reports with lab reports:', totalReports);
    
    const pendingReviews = await TestRequest.countDocuments({
      'labReport.filePath': { $exists: true },
      'superConsultantReview.isReviewed': false
    });
    
    const reviewedReports = await TestRequest.countDocuments({
      'superConsultantReview.isReviewed': true
    });
    
    const approvedReports = await TestRequest.countDocuments({
      'superConsultantReview.status': 'Approved'
    });
    
    const needsAdditionalTests = await TestRequest.countDocuments({
      'superConsultantReview.status': 'Needs_Additional_Tests'
    });
    
    const rejectedReports = await TestRequest.countDocuments({
      'superConsultantReview.status': 'Rejected'
    });

    res.status(200).json({
      totalReports,
      pendingReviews,
      reviewedReports,
      approvedReports,
      needsAdditionalTests,
      rejectedReports
    });
  } catch (error) {
    console.error('Get super consultant dashboard stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get test requests by review status
export const getTestRequestsByReviewStatus = async (req, res) => {
  try {
    const { status } = req.params;
    
    let query = {
      'labReport.filePath': { $exists: true }
    };

    if (status === 'pending') {
      query['superConsultantReview.isReviewed'] = false;
      query.status = { $in: ['Report_Generated', 'Report_Sent'] };
    } else if (status === 'reviewed') {
      query['superConsultantReview.isReviewed'] = true;
    } else if (status === 'approved') {
      query['superConsultantReview.status'] = 'Approved';
    } else if (status === 'needs_additional_tests') {
      query['superConsultantReview.status'] = 'Needs_Additional_Tests';
    } else if (status === 'rejected') {
      query['superConsultantReview.status'] = 'Rejected';
    }

    const testRequests = await TestRequest.find(query)
      .populate('doctorId', 'firstName lastName name email')
      .populate('patientId', 'firstName lastName name email phone contactNumber address dateOfBirth gender')
      .populate('assignedTo', 'firstName lastName name email')
      .populate('centerId', 'name centerCode')
      .populate('labReport.generatedBy', 'firstName lastName name')
      .populate('superConsultantReview.reviewedBy', 'firstName lastName name')
      .sort({ createdAt: -1 });

    // Format the data for frontend consumption
    const formattedRequests = testRequests.map(request => ({
      _id: request._id,
      patientId: request.patientId?._id || request.patientId,
      patientName: request.patientId ? 
        `${request.patientId.firstName || ''} ${request.patientId.lastName || ''}`.trim() || 
        request.patientId.name : 'Unknown Patient',
      patientPhone: request.patientId?.phone || request.patientId?.contactNumber || 'N/A',
      patientAddress: request.patientId?.address || 'N/A',
      patientAge: request.patientId?.dateOfBirth ? 
        Math.floor((new Date() - new Date(request.patientId.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000)) : 'N/A',
      patientGender: request.patientId?.gender || 'N/A',
      doctorName: request.doctorId ? 
        `${request.doctorId.firstName || ''} ${request.doctorId.lastName || ''}`.trim() || 
        request.doctorId.name : 'Unknown Doctor',
      doctorEmail: request.doctorId?.email || 'N/A',
      centerName: request.centerId?.name || 'N/A',
      testType: Array.isArray(request.testTypes) ? request.testTypes.join(', ') : request.testTypes || 'N/A',
      status: request.status || 'Pending',
      urgency: request.priority || 'Normal',
      notes: request.notes || '',
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      reportFilePath: request.labReport?.filePath || null,
      reportFileName: request.labReport?.fileName || null,
      reportGeneratedDate: request.labReport?.generatedDate || null,
      reportGeneratedBy: request.labReport?.generatedBy ? 
        `${request.labReport.generatedBy.firstName || ''} ${request.labReport.generatedBy.lastName || ''}`.trim() || 
        request.labReport.generatedBy.name : null,
      // Super consultant review data
      isReviewed: request.superConsultantReview?.isReviewed || false,
      reviewStatus: request.superConsultantReview?.status || 'Pending',
      reviewDate: request.superConsultantReview?.reviewDate || null,
      reviewerName: request.superConsultantReview?.reviewedBy ? 
        `${request.superConsultantReview.reviewedBy.firstName || ''} ${request.superConsultantReview.reviewedBy.lastName || ''}`.trim() || 
        request.superConsultantReview.reviewedBy.name : null,
      feedback: request.superConsultantReview?.feedback || null,
      additionalTestsRequired: request.superConsultantReview?.additionalTestsRequired || [],
      recommendations: request.superConsultantReview?.recommendations || null
    }));

    res.status(200).json(formattedRequests);
  } catch (error) {
    console.error('Get test requests by review status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get patient details for super consultant
export const getPatientDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await Patient.findById(id)
      .populate('center', 'name centerCode address contactNumber email');

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    res.status(200).json(patient);
  } catch (error) {
    console.error('Get patient details error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get patient medical history for super consultant
export const getPatientMedicalHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const patientHistory = await PatientHistory.find({ patient: id })
      .populate('patient', 'firstName lastName name email phone contactNumber dateOfBirth gender address occupation spouseName')
      .populate('createdBy', 'firstName lastName name email')
      .populate('updatedBy', 'firstName lastName name email')
      .populate('center', 'name centerCode address contactNumber email')
      .sort({ createdAt: -1 });

    console.log('Super Consultant - Patient History Query:', { patient: id });
    console.log('Super Consultant - Found patient history:', patientHistory.length);
    console.log('Super Consultant - Patient history data:', patientHistory);

    res.status(200).json(patientHistory);
  } catch (error) {
    console.error('Get patient medical history error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get patient test requests for super consultant
export const getPatientTestRequests = async (req, res) => {
  try {
    const { id } = req.params;

    const testRequests = await TestRequest.find({ patientId: id })
      .populate('patientId', 'firstName lastName name email phone contactNumber')
      .populate('doctorId', 'firstName lastName name email')
      .populate('assignedTo', 'firstName lastName name email')
      .populate('centerId', 'name centerCode')
      .populate('labReport.generatedBy', 'firstName lastName name')
      .populate('superConsultantReview.reviewedBy', 'firstName lastName name')
      .sort({ createdAt: -1 });

    console.log('Super Consultant - Patient Test Requests Query:', { patient: id });
    console.log('Super Consultant - Found test requests:', testRequests.length);
    console.log('Super Consultant - Test requests data:', testRequests.map(req => ({
      _id: req._id,
      testTypes: req.testTypes,
      doctorId: req.doctorId,
      status: req.status,
      createdAt: req.createdAt
    })));

    res.status(200).json(testRequests);
  } catch (error) {
    console.error('Get patient test requests error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
