const axios = require('axios');

async function test() {
  try {
    console.log("Registering hospital...");
    const regRes = await axios.post('http://localhost:5000/v1/auth/register', {
      name: 'Test Admin',
      email: 'test_hospital@example.com',
      phone: '1234567890',
      password: 'password123',
      role: 'hospital',
      hospitalName: 'Test Hospital',
      registrationNumber: 'H123',
      address: 'Test Address',
      lat: 24.8,
      lng: 67.0,
      departments: ['Internal Medicine'],
      bedsInventory: [
        { ward: 'General', totalBeds: 10, availableBeds: 5 },
        { ward: 'Private', totalBeds: 5, availableBeds: 5 },
        { ward: 'ICU', totalBeds: 5, availableBeds: 5 },
        { ward: 'NICU', totalBeds: 5, availableBeds: 5 },
        { ward: 'PICU', totalBeds: 5, availableBeds: 5 }
      ]
    });
    console.log("Reg Success:", regRes.data);

    console.log("Attempting login...");
    const loginRes = await axios.post('http://localhost:5000/v1/auth/login', {
      email: 'test_hospital@example.com',
      password: 'password123'
    });
    console.log("Login Success:", loginRes.data);

  } catch (error) {
    console.error("Error:", error.response ? error.response.data : error.message);
  }
}

test();
