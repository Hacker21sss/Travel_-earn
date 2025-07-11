const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:7755'; // Adjust if your server runs on different port
const TEST_PHONE_NUMBER = '9876543210'; // Test phone number

// Test data
const testAddress = {
  phoneNumber: TEST_PHONE_NUMBER,
  location: "Test Location, New Delhi",
  pincode: "110001",
  flat: "123, Test Building",
  street: "Test Street",
  landmark: "Near Test Landmark",
  city: "New Delhi",
  state: "Delhi",
  saveAs: "Home",
  displayAddress: "123, Test Building, Test Street, Near Test Landmark, New Delhi, Delhi - 110001",
  googleMapsAddress: "Test Location, New Delhi, 110001, New Delhi, Delhi",
  latitude: 28.6139,
  longitude: 77.2090
};

const testAddressOthers = {
  ...testAddress,
  saveAs: "Others",
  customName: "Test Custom Address"
};

async function testAddressAPI() {
  console.log('🚀 Testing Address API...\n');

  try {
    // Test 1: Add address (Home)
    console.log('1. Testing Add Address (Home)...');
    const addResponse = await axios.post(`${BASE_URL}/address/address`, testAddress);
    console.log('✅ Add Address (Home) - Success:', addResponse.data.message);
    const addressId = addResponse.data.address._id;
    console.log('   Address ID:', addressId);

    // Test 2: Add address (Others)
    console.log('\n2. Testing Add Address (Others)...');
    const addOthersResponse = await axios.post(`${BASE_URL}/address/address`, testAddressOthers);
    console.log('✅ Add Address (Others) - Success:', addOthersResponse.data.message);

    // Test 3: Get addresses by user
    console.log('\n3. Testing Get Addresses by User...');
    const getResponse = await axios.get(`${BASE_URL}/address/getaddress/${TEST_PHONE_NUMBER}`);
    console.log('✅ Get Addresses - Success');
    console.log('   Total addresses:', getResponse.data.count);
    console.log('   Addresses:', getResponse.data.addresses.map(addr => ({
      id: addr.id,
      saveAs: addr.saveAs,
      customName: addr.customName,
      city: addr.city
    })));

    // Test 4: Update address
    console.log('\n4. Testing Update Address...');
    const updateData = {
      ...testAddress,
      flat: "456, Updated Building",
      street: "Updated Street",
      saveAs: "Work"
    };
    const updateResponse = await axios.put(`${BASE_URL}/address/update/${addressId}`, updateData);
    console.log('✅ Update Address - Success:', updateResponse.data.message);

    // Test 5: Delete address
    console.log('\n5. Testing Delete Address...');
    const deleteResponse = await axios.delete(`${BASE_URL}/address/delete/${addressId}`);
    console.log('✅ Delete Address - Success:', deleteResponse.data.message);

    console.log('\n🎉 All tests passed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Run the test
testAddressAPI(); 