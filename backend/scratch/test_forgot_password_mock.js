const axios = require('axios');

async function test() {
  console.log('Sending Forgot Password request for admin@carebridge.local...');
  try {
    const res = await axios.post('http://localhost:5000/v1/auth/forgot-password', {
      email: 'admin@carebridge.local'
    });
    console.log('Response status:', res.status);
    console.log('Response data:', res.data);
  } catch (err) {
    console.error('Request failed:', err.message, err.response?.data);
  }
}

test();
