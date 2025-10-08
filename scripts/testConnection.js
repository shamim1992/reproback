import axios from 'axios';

const testConnection = async () => {
  try {
    console.log('Testing connection to backend...');
    
    // Test basic connectivity
    const response = await axios.get('http://localhost:5001/api/auth/profile', {
      headers: {
        'Authorization': 'Bearer invalid-token' // This should return 401, not network error
      }
    });
    
    console.log('Unexpected success:', response.status);
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Connection refused - Backend server is not running');
    } else if (error.response?.status === 401) {
      console.log('✅ Backend is running and responding (401 as expected)');
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
  
  try {
    console.log('\nTesting login endpoint...');
    const response = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'shamimakhtarsheikh@gmail.com',
      password: 'admin123'
    });
    
    console.log('✅ Login endpoint working:', response.status);
    console.log('✅ Token received:', !!response.data.token);
  } catch (error) {
    console.log('❌ Login endpoint error:', error.message);
  }
};

testConnection();


