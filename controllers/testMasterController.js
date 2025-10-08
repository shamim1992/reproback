import TestMaster from '../models/testMasterModel.js';

// Get all tests
export const getAllTests = async (req, res) => {
  try {
    const { isActive, category, search } = req.query;
    
    let query = {};
    
    // Filter by active status
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    // Filter by category
    if (category) {
      query.category = category;
    }
    
    // Search by test name or code
    if (search) {
      query.$or = [
        { testName: { $regex: search, $options: 'i' } },
        { testCode: { $regex: search, $options: 'i' } }
      ];
    }
    
    const tests = await TestMaster.find(query)
      .sort({ testName: 1 })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
    
    res.status(200).json({
      success: true,
      count: tests.length,
      data: tests
    });
  } catch (error) {
    console.error('Error fetching tests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tests',
      error: error.message
    });
  }
};

// Get single test by ID
export const getTestById = async (req, res) => {
  try {
    const test = await TestMaster.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
    
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: test
    });
  } catch (error) {
    console.error('Error fetching test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch test',
      error: error.message
    });
  }
};

// Get test by code
export const getTestByCode = async (req, res) => {
  try {
    const test = await TestMaster.findOne({ testCode: req.params.code.toUpperCase() });
    
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: test
    });
  } catch (error) {
    console.error('Error fetching test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch test',
      error: error.message
    });
  }
};

// Create new test
export const createTest = async (req, res) => {
  try {
    const { testCode, testName, testPrice, description, category, duration, sampleType } = req.body;
    
    // Check if test code already exists
    const existingTest = await TestMaster.findOne({ testCode: testCode.toUpperCase() });
    if (existingTest) {
      return res.status(400).json({
        success: false,
        message: 'Test code already exists'
      });
    }
    
    const test = new TestMaster({
      testCode: testCode.toUpperCase(),
      testName,
      testPrice,
      description,
      category,
      duration,
      sampleType,
      createdBy: req.user.id
    });
    
    await test.save();
    
    res.status(201).json({
      success: true,
      message: 'Test created successfully',
      data: test
    });
  } catch (error) {
    console.error('Error creating test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create test',
      error: error.message
    });
  }
};

// Update test
export const updateTest = async (req, res) => {
  try {
    const { testCode, testName, testPrice, description, category, duration, sampleType, isActive } = req.body;
    
    const test = await TestMaster.findById(req.params.id);
    
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }
    
    // Check if new test code already exists (if changing code)
    if (testCode && testCode.toUpperCase() !== test.testCode) {
      const existingTest = await TestMaster.findOne({ testCode: testCode.toUpperCase() });
      if (existingTest) {
        return res.status(400).json({
          success: false,
          message: 'Test code already exists'
        });
      }
      test.testCode = testCode.toUpperCase();
    }
    
    if (testName) test.testName = testName;
    if (testPrice !== undefined) test.testPrice = testPrice;
    if (description !== undefined) test.description = description;
    if (category) test.category = category;
    if (duration) test.duration = duration;
    if (sampleType) test.sampleType = sampleType;
    if (isActive !== undefined) test.isActive = isActive;
    test.updatedBy = req.user.id;
    
    await test.save();
    
    res.status(200).json({
      success: true,
      message: 'Test updated successfully',
      data: test
    });
  } catch (error) {
    console.error('Error updating test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update test',
      error: error.message
    });
  }
};

// Delete test (soft delete by setting isActive to false)
export const deleteTest = async (req, res) => {
  try {
    const test = await TestMaster.findById(req.params.id);
    
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }
    
    test.isActive = false;
    test.updatedBy = req.user.id;
    await test.save();
    
    res.status(200).json({
      success: true,
      message: 'Test deactivated successfully'
    });
  } catch (error) {
    console.error('Error deleting test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete test',
      error: error.message
    });
  }
};

// Hard delete test (permanently remove from database)
export const hardDeleteTest = async (req, res) => {
  try {
    const test = await TestMaster.findByIdAndDelete(req.params.id);
    
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Test permanently deleted'
    });
  } catch (error) {
    console.error('Error hard deleting test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete test',
      error: error.message
    });
  }
};

// Delete all tests (hard delete - permanently remove all from database)
export const deleteAllTests = async (req, res) => {
  try {
    const result = await TestMaster.deleteMany({});
    
    res.status(200).json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} tests`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error deleting all tests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete all tests',
      error: error.message
    });
  }
};

// Bulk import tests
export const bulkImportTests = async (req, res) => {
  try {
    const { tests } = req.body;
    
    if (!Array.isArray(tests) || tests.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of tests'
      });
    }
    
    console.log(`Starting bulk import of ${tests.length} tests...`);
    
    const results = {
      success: [],
      failed: []
    };
    
    // Process in batches to avoid memory issues
    const batchSize = 100;
    const batches = [];
    
    for (let i = 0; i < tests.length; i += batchSize) {
      batches.push(tests.slice(i, i + batchSize));
    }
    
    console.log(`Processing ${batches.length} batches of ${batchSize} tests each...`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} tests)...`);
      
      // Get existing test codes for this batch
      const testCodes = batch.map(t => t.testCode?.toUpperCase()).filter(Boolean);
      const existingTests = await TestMaster.find({ testCode: { $in: testCodes } });
      const existingCodes = new Set(existingTests.map(t => t.testCode));
      
      // Prepare batch for insertion
      const testsToInsert = [];
      const batchResults = { success: [], failed: [] };
      
      for (const testData of batch) {
        try {
          // Validate required fields
          if (!testData.testCode || !testData.testName || testData.testPrice === undefined) {
            batchResults.failed.push({
              testCode: testData.testCode || 'Unknown',
              reason: 'Missing required fields (testCode, testName, or testPrice)'
            });
            continue;
          }
          
          const upperTestCode = testData.testCode.toUpperCase();
          
          if (existingCodes.has(upperTestCode)) {
            batchResults.failed.push({
              testCode: testData.testCode,
              reason: 'Test code already exists'
            });
            continue;
          }
          
          testsToInsert.push({
            testCode: upperTestCode,
            testName: testData.testName,
            testPrice: parseFloat(testData.testPrice),
            description: testData.description || '',
            category: testData.category || 'Other',
            duration: testData.duration || '24 hours',
            sampleType: testData.sampleType || 'Blood',
            createdBy: req.user.id
          });
          
          batchResults.success.push(testData.testCode);
        } catch (error) {
          batchResults.failed.push({
            testCode: testData.testCode || 'Unknown',
            reason: error.message
          });
        }
      }
      
      // Insert batch if there are tests to insert
      if (testsToInsert.length > 0) {
        try {
          await TestMaster.insertMany(testsToInsert, { ordered: false });
          console.log(`Successfully inserted ${testsToInsert.length} tests in batch ${batchIndex + 1}`);
        } catch (error) {
          console.error(`Error inserting batch ${batchIndex + 1}:`, error);
          // If batch insert fails, try individual inserts
          for (const testData of testsToInsert) {
            try {
              await TestMaster.create(testData);
            } catch (individualError) {
              batchResults.failed.push({
                testCode: testData.testCode,
                reason: individualError.message
              });
              // Remove from success if it was added there
              const successIndex = batchResults.success.indexOf(testData.testCode);
              if (successIndex > -1) {
                batchResults.success.splice(successIndex, 1);
              }
            }
          }
        }
      }
      
      // Add batch results to overall results
      results.success.push(...batchResults.success);
      results.failed.push(...batchResults.failed);
    }
    
    console.log(`Import completed. ${results.success.length} tests imported, ${results.failed.length} failed.`);
    
    res.status(200).json({
      success: true,
      message: `Import completed. ${results.success.length} tests imported, ${results.failed.length} failed.`,
      data: results
    });
  } catch (error) {
    console.error('Error bulk importing tests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import tests',
      error: error.message
    });
  }
};

