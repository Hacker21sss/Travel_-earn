# Address API Documentation

This document describes the Address API endpoints for the Travel & Earn application.

## Base URL
```
http://localhost:7755/address
```

## Endpoints

### 1. Add New Address
**POST** `/address`

Adds a new address for a user.

#### Request Body
```json
{
  "phoneNumber": "string (required)",
  "location": "string (required)",
  "pincode": "string (required, 6 digits)",
  "flat": "string (required)",
  "street": "string (required)",
  "landmark": "string (required)",
  "city": "string (required)",
  "state": "string (required)",
  "saveAs": "string (required, enum: ['Home', 'Others', 'Work'])",
  "customName": "string (required when saveAs is 'Others')",
  "displayAddress": "string (optional)",
  "googleMapsAddress": "string (optional)",
  "latitude": "number (optional)",
  "longitude": "number (optional)"
}
```

#### Response
```json
{
  "message": "Address saved successfully",
  "address": {
    "_id": "address_id",
    "phoneNumber": "9876543210",
    "location": "Test Location, New Delhi",
    "pincode": "110001",
    "flat": "123, Test Building",
    "street": "Test Street",
    "landmark": "Near Test Landmark",
    "city": "New Delhi",
    "state": "Delhi",
    "saveAs": "Home",
    "customName": null,
    "displayAddress": "123, Test Building, Test Street, Near Test Landmark, New Delhi, Delhi - 110001",
    "googleMapsAddress": "Test Location, New Delhi, 110001, New Delhi, Delhi",
    "latitude": 28.6139,
    "longitude": 77.2090,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 2. Get Addresses by User
**GET** `/getaddress/:phoneNumber`

Retrieves all addresses for a specific user.

#### Parameters
- `phoneNumber` (string, required): User's phone number

#### Response
```json
{
  "success": true,
  "addresses": [
    {
      "id": "address_id",
      "phoneNumber": "9876543210",
      "location": "Test Location, New Delhi",
      "pincode": "110001",
      "flat": "123, Test Building",
      "street": "Test Street",
      "landmark": "Near Test Landmark",
      "city": "New Delhi",
      "state": "Delhi",
      "saveAs": "Home",
      "customName": null,
      "displayAddress": "123, Test Building, Test Street, Near Test Landmark, New Delhi, Delhi - 110001",
      "googleMapsAddress": "Test Location, New Delhi, 110001, New Delhi, Delhi",
      "latitude": 28.6139,
      "longitude": 77.2090,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

### 3. Update Address
**PUT** `/update/:addressId`

Updates an existing address.

#### Parameters
- `addressId` (string, required): Address ID

#### Request Body
Same as Add Address (all fields except phoneNumber are required)

#### Response
```json
{
  "message": "Address updated successfully",
  "address": {
    // Updated address object
  }
}
```

### 4. Delete Address
**DELETE** `/delete/:addressId`

Deletes an address.

#### Parameters
- `addressId` (string, required): Address ID

#### Response
```json
{
  "message": "Address deleted successfully"
}
```

## Error Responses

### Validation Errors (400)
```json
{
  "message": "phoneNumber, location, pincode, flat, street, landmark, city, and state are required"
}
```

```json
{
  "message": "Invalid pincode format. Use 6 digits."
}
```

```json
{
  "message": "saveAs must be one of: Home, Others, Work"
}
```

```json
{
  "message": "customName is required when saveAs is 'Others'"
}
```

### Not Found (404)
```json
{
  "message": "Address not found"
}
```

### Server Error (500)
```json
{
  "message": "Internal Server Error",
  "error": "Error details"
}
```

## Frontend Integration

### Example: Adding an Address
```javascript
const addAddress = async (addressData) => {
  try {
    const baseurl = await AsyncStorage.getItem("apiBaseUrl");
    const phoneNumber = await AsyncStorage.getItem("phoneNumber");

    const response = await fetch(`${baseurl}address/address`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...addressData,
        phoneNumber,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log("Address saved:", result.message);
      return result.address;
    } else {
      const error = await response.json();
      throw new Error(error.message);
    }
  } catch (error) {
    console.error("Error saving address:", error);
    throw error;
  }
};
```

### Example: Getting User Addresses
```javascript
const getAddresses = async () => {
  try {
    const baseurl = await AsyncStorage.getItem("apiBaseUrl");
    const phoneNumber = await AsyncStorage.getItem("phoneNumber");

    const response = await fetch(`${baseurl}address/getaddress/${phoneNumber}`);
    
    if (response.ok) {
      const result = await response.json();
      return result.addresses;
    } else {
      const error = await response.json();
      throw new Error(error.message);
    }
  } catch (error) {
    console.error("Error fetching addresses:", error);
    throw error;
  }
};
```

## Database Schema

The address data is stored in the `Address12` collection with the following schema:

```javascript
{
  userId: String,
  phoneNumber: String,
  location: String,
  pincode: String (required),
  flat: String (required),
  street: String (required),
  landmark: String (required),
  city: String (required),
  state: String (required),
  saveAs: String (enum: ["Home", "Others", "Work"], required),
  customName: String (optional, for "Others" option),
  displayAddress: String (optional),
  googleMapsAddress: String (optional),
  latitude: Number (optional),
  longitude: Number (optional),
  createdAt: Date,
  updatedAt: Date
}
```

## Testing

Run the test script to verify all endpoints:

```bash
node test_address_api.js
```

Make sure your server is running on port 7755 before running the tests.

## Notes

1. **Pincode Validation**: Must be exactly 6 digits
2. **SaveAs Options**: Only "Home", "Others", or "Work" are allowed
3. **Custom Name**: Required when saveAs is "Others"
4. **Duplicate Prevention**: System prevents saving duplicate addresses for the same user
5. **Coordinates**: Optional latitude/longitude for map integration
6. **Timestamps**: Automatically managed by the system 