import User from '../models/userModel.js';
import Patient from '../models/patientModel.js';
import TestRequest from '../models/testRequestModel.js';
import Billing from '../models/billingModel.js';
import Center from '../models/centerModel.js';
import PatientHistory from '../models/patientHistoryModel.js';

// Get comprehensive dashboard statistics for super admin
export const getSuperAdminDashboardStats = async (req, res) => {
  try {
    // User Statistics
    const totalUsers = await User.countDocuments({ isActive: true });
    const adminUsers = await User.countDocuments({ role: 'Admin', isActive: true });
    const doctors = await User.countDocuments({ role: 'Doctor', isActive: true });
    const receptionists = await User.countDocuments({ role: 'Receptionist', isActive: true });
    const accountants = await User.countDocuments({ role: 'Accountant', isActive: true });
    const labStaff = await User.countDocuments({ 
      role: { $in: ['Lab Manager', 'Lab Technician', 'Lab Assistant', 'Lab Director', 'Quality Control'] }, 
      isActive: true 
    });
    const superConsultants = await User.countDocuments({ role: 'Super Consultant', isActive: true });
    const inactiveUsers = await User.countDocuments({ isActive: false });

    // Patient Statistics
    const totalPatients = await Patient.countDocuments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const patientsToday = await Patient.countDocuments({ 
      createdAt: { $gte: today } 
    });
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const patientsThisWeek = await Patient.countDocuments({ 
      createdAt: { $gte: lastWeek } 
    });
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const patientsThisMonth = await Patient.countDocuments({ 
      createdAt: { $gte: lastMonth } 
    });

    // Gender distribution
    const malePatients = await Patient.countDocuments({ gender: 'male' });
    const femalePatients = await Patient.countDocuments({ gender: 'female' });
    const otherGenderPatients = await Patient.countDocuments({ gender: 'other' });

    // Test Request Statistics
    const totalTestRequests = await TestRequest.countDocuments();
    const pendingTestRequests = await TestRequest.countDocuments({ 
      status: { $in: ['Pending', 'Billing_Pending'] } 
    });
    const billingGeneratedRequests = await TestRequest.countDocuments({ 
      status: 'Billing_Generated' 
    });
    const billingPaidRequests = await TestRequest.countDocuments({ 
      status: 'Billing_Paid' 
    });
    const approvedRequests = await TestRequest.countDocuments({ 
      status: 'Superadmin_Approved' 
    });
    const assignedRequests = await TestRequest.countDocuments({ 
      status: 'Assigned' 
    });
    const sampleCollectionScheduled = await TestRequest.countDocuments({ 
      status: 'Sample_Collection_Scheduled' 
    });
    const sampleCollected = await TestRequest.countDocuments({ 
      status: 'Sample_Collected' 
    });
    const inLabTesting = await TestRequest.countDocuments({ 
      status: 'In_Lab_Testing' 
    });
    const testingCompleted = await TestRequest.countDocuments({ 
      status: 'Testing_Completed' 
    });
    const reportGenerated = await TestRequest.countDocuments({ 
      status: 'Report_Generated' 
    });
    const reportSent = await TestRequest.countDocuments({ 
      status: 'Report_Sent' 
    });
    const completedTestRequests = await TestRequest.countDocuments({ 
      status: 'Completed' 
    });
    const cancelledRequests = await TestRequest.countDocuments({ 
      status: 'Cancelled' 
    });
    const onHoldRequests = await TestRequest.countDocuments({ 
      status: 'On_Hold' 
    });
    const needsAdditionalTests = await TestRequest.countDocuments({ 
      status: 'Needs_Additional_Tests' 
    });

    // Test requests today, this week, this month
    const testRequestsToday = await TestRequest.countDocuments({ 
      createdAt: { $gte: today } 
    });
    const testRequestsThisWeek = await TestRequest.countDocuments({ 
      createdAt: { $gte: lastWeek } 
    });
    const testRequestsThisMonth = await TestRequest.countDocuments({ 
      createdAt: { $gte: lastMonth } 
    });

    // Priority distribution
    const urgentRequests = await TestRequest.countDocuments({ priority: 'Urgent' });
    const highPriorityRequests = await TestRequest.countDocuments({ priority: 'High' });
    const normalPriorityRequests = await TestRequest.countDocuments({ priority: 'Normal' });
    const lowPriorityRequests = await TestRequest.countDocuments({ priority: 'Low' });

    // Super Consultant Review Statistics
    const totalReportsWithLabReport = await TestRequest.countDocuments({
      'labReport.filePath': { $exists: true }
    });
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
    const rejectedReports = await TestRequest.countDocuments({
      'superConsultantReview.status': 'Rejected'
    });

    // Billing Statistics
    const totalBillings = await Billing.countDocuments({ isActive: true });
    const pendingBillings = await Billing.countDocuments({ 
      paymentStatus: 'pending', 
      isActive: true 
    });
    const paidBillings = await Billing.countDocuments({ 
      paymentStatus: 'paid', 
      isActive: true 
    });
    const partialBillings = await Billing.countDocuments({ 
      paymentStatus: 'partial', 
      isActive: true 
    });
    const cancelledBillings = await Billing.countDocuments({ 
      paymentStatus: 'cancelled', 
      isActive: true 
    });

    // Revenue Statistics
    const revenueStats = await Billing.aggregate([
      { $match: { isActive: true, paymentStatus: { $in: ['paid', 'partial'] } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$paidAmount' },
          totalBilled: { $sum: '$totalAmount' },
          pendingAmount: { $sum: { $subtract: ['$totalAmount', '$paidAmount'] } }
        }
      }
    ]);

    const revenue = revenueStats.length > 0 ? revenueStats[0] : {
      totalRevenue: 0,
      totalBilled: 0,
      pendingAmount: 0
    };

    // Today's revenue
    const todayRevenue = await Billing.aggregate([
      { 
        $match: { 
          isActive: true, 
          paymentStatus: { $in: ['paid', 'partial'] },
          paymentDate: { $gte: today }
        } 
      },
      {
        $group: {
          _id: null,
          todayRevenue: { $sum: '$paidAmount' }
        }
      }
    ]);

    const todayRevenueAmount = todayRevenue.length > 0 ? todayRevenue[0].todayRevenue : 0;

    // This week's revenue
    const weekRevenue = await Billing.aggregate([
      { 
        $match: { 
          isActive: true, 
          paymentStatus: { $in: ['paid', 'partial'] },
          paymentDate: { $gte: lastWeek }
        } 
      },
      {
        $group: {
          _id: null,
          weekRevenue: { $sum: '$paidAmount' }
        }
      }
    ]);

    const weekRevenueAmount = weekRevenue.length > 0 ? weekRevenue[0].weekRevenue : 0;

    // This month's revenue
    const monthRevenue = await Billing.aggregate([
      { 
        $match: { 
          isActive: true, 
          paymentStatus: { $in: ['paid', 'partial'] },
          paymentDate: { $gte: lastMonth }
        } 
      },
      {
        $group: {
          _id: null,
          monthRevenue: { $sum: '$paidAmount' }
        }
      }
    ]);

    const monthRevenueAmount = monthRevenue.length > 0 ? monthRevenue[0].monthRevenue : 0;

    // Center Statistics
    const totalCenters = await Center.countDocuments({ isActive: true });
    const inactiveCenters = await Center.countDocuments({ isActive: false });

    // Patient History Statistics
    const totalPatientHistories = await PatientHistory.countDocuments();
    const historiesThisMonth = await PatientHistory.countDocuments({ 
      createdAt: { $gte: lastMonth } 
    });

    // Recent Activity Statistics
    const recentTestRequests = await TestRequest.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('patientId', 'name email')
      .populate('doctorId', 'firstName lastName')
      .populate('centerId', 'name')
      .select('testTypes status priority createdAt');

    const recentBillings = await Billing.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('patient', 'name email')
      .populate('center', 'name')
      .select('billNumber totalAmount paymentStatus createdAt');

    const recentUsers = await User.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('firstName lastName email role createdAt');

    // Response
    res.status(200).json({
      users: {
        total: totalUsers,
        admins: adminUsers,
        doctors: doctors,
        receptionists: receptionists,
        accountants: accountants,
        labStaff: labStaff,
        superConsultants: superConsultants,
        inactive: inactiveUsers
      },
      patients: {
        total: totalPatients,
        today: patientsToday,
        thisWeek: patientsThisWeek,
        thisMonth: patientsThisMonth,
        male: malePatients,
        female: femalePatients,
        other: otherGenderPatients
      },
      testRequests: {
        total: totalTestRequests,
        pending: pendingTestRequests,
        billingGenerated: billingGeneratedRequests,
        billingPaid: billingPaidRequests,
        approved: approvedRequests,
        assigned: assignedRequests,
        sampleCollectionScheduled: sampleCollectionScheduled,
        sampleCollected: sampleCollected,
        inLabTesting: inLabTesting,
        testingCompleted: testingCompleted,
        reportGenerated: reportGenerated,
        reportSent: reportSent,
        completed: completedTestRequests,
        cancelled: cancelledRequests,
        onHold: onHoldRequests,
        needsAdditionalTests: needsAdditionalTests,
        today: testRequestsToday,
        thisWeek: testRequestsThisWeek,
        thisMonth: testRequestsThisMonth,
        urgent: urgentRequests,
        highPriority: highPriorityRequests,
        normalPriority: normalPriorityRequests,
        lowPriority: lowPriorityRequests
      },
      superConsultantReview: {
        totalReportsWithLabReport: totalReportsWithLabReport,
        pendingReviews: pendingReviews,
        reviewedReports: reviewedReports,
        approvedReports: approvedReports,
        rejectedReports: rejectedReports
      },
      billing: {
        total: totalBillings,
        pending: pendingBillings,
        paid: paidBillings,
        partial: partialBillings,
        cancelled: cancelledBillings
      },
      revenue: {
        total: revenue.totalRevenue || 0,
        totalBilled: revenue.totalBilled || 0,
        pending: revenue.pendingAmount || 0,
        today: todayRevenueAmount,
        thisWeek: weekRevenueAmount,
        thisMonth: monthRevenueAmount
      },
      centers: {
        total: totalCenters,
        inactive: inactiveCenters
      },
      patientHistory: {
        total: totalPatientHistories,
        thisMonth: historiesThisMonth
      },
      recentActivity: {
        testRequests: recentTestRequests,
        billings: recentBillings,
        users: recentUsers
      }
    });
  } catch (error) {
    console.error('Get super admin dashboard stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get system overview statistics
export const getSystemOverview = async (req, res) => {
  try {
    const { timeRange = '7days' } = req.query;

    let startDate = new Date();
    switch (timeRange) {
      case '24hours':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7days':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30days':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90days':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    // Get trend data for test requests
    const testRequestTrend = await TestRequest.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ]);

    // Get trend data for revenue
    const revenueTrend = await Billing.aggregate([
      {
        $match: {
          isActive: true,
          paymentStatus: { $in: ['paid', 'partial'] },
          paymentDate: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$paymentDate' } }
          },
          revenue: { $sum: '$paidAmount' }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ]);

    // Get status distribution
    const statusDistribution = await TestRequest.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get center performance
    const centerPerformance = await TestRequest.aggregate([
      {
        $group: {
          _id: '$centerId',
          totalRequests: { $sum: 1 },
          completedRequests: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'Completed'] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'centers',
          localField: '_id',
          foreignField: '_id',
          as: 'centerInfo'
        }
      },
      {
        $unwind: '$centerInfo'
      },
      {
        $project: {
          centerName: '$centerInfo.name',
          centerCode: '$centerInfo.centerCode',
          totalRequests: 1,
          completedRequests: 1,
          completionRate: {
            $cond: [
              { $eq: ['$totalRequests', 0] },
              0,
              { $multiply: [{ $divide: ['$completedRequests', '$totalRequests'] }, 100] }
            ]
          }
        }
      },
      {
        $sort: { totalRequests: -1 }
      }
    ]);

    res.status(200).json({
      testRequestTrend,
      revenueTrend,
      statusDistribution,
      centerPerformance
    });
  } catch (error) {
    console.error('Get system overview error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


