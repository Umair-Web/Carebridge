const axios = require('axios');

async function run() {
  console.log('Sending login request for admin@carebridge.local...');
  try {
    const loginRes = await axios.post('http://localhost:5000/v1/auth/login', {
      email: 'admin@carebridge.local',
      password: 'Admin123!'
    });

    const token = loginRes.data.data.accessToken;
    console.log('Login successful! Access token obtained:', token.slice(0, 20) + '...');

    const headers = {
      Authorization: `Bearer ${token}`
    };

    console.log('\n1. Testing GET /v1/admin/analytics ...');
    try {
      const res = await axios.get('http://localhost:5000/v1/admin/analytics', { headers });
      console.log('GET /v1/admin/analytics SUCCESS:', res.data.success);
    } catch (err) {
      console.error('GET /v1/admin/analytics FAILED:', err.response?.status, err.response?.data);
    }

    console.log('\n2. Testing GET /v1/admin/audit-logs ...');
    try {
      const res = await axios.get('http://localhost:5000/v1/admin/audit-logs', { headers });
      console.log('GET /v1/admin/audit-logs SUCCESS:', res.data.success);
    } catch (err) {
      console.error('GET /v1/admin/audit-logs FAILED:', err.response?.status, err.response?.data);
    }

    console.log('\n3. Testing GET /v1/admin/beds ...');
    try {
      const res = await axios.get('http://localhost:5000/v1/admin/beds', { headers });
      console.log('GET /v1/admin/beds SUCCESS:', res.data.success);
    } catch (err) {
      console.error('GET /v1/admin/beds FAILED:', err.response?.status, err.response?.data);
    }

  } catch (err) {
    console.error('Login request failed:', err.message, err.response?.data);
  }
}

run();
