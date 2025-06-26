# Consignment Image Upload Implementation

## Overview
This document describes the changes made to support multiple image uploads for consignment creation using the existing upload middleware and ImageKit integration.

## Changes Made

### 1. Updated Consignment Model (`consignment/model/contraveldetails.js`)
- Changed `images` field from a single string to an array of strings to store multiple image URLs
- Added support for `handleWithCare` (boolean) and `specialRequest` (string) fields

### 2. Updated Consignment Router (`consignment/router/consignment.router.js`)
- Modified the POST `/consignment` route to use `upload.array('images', 5)` for handling up to 5 images
- Added validation middleware to the route

### 3. Updated Consignment Controller (`consignment/conroller/consignment.details.js`)
- Added ImageKit import for cloud image storage
- Modified `createConsignment` function to:
  - Handle multiple file uploads (`req.files`)
  - Upload each image to ImageKit and store URLs
  - Parse dimensions from JSON string if needed
  - Handle `handleWithCare` and `specialRequest` fields
  - Store image URLs as an array in the database

## API Endpoint

### POST `/api/consignment`
Creates a new consignment with support for multiple image uploads.

**Request Format:**
- Content-Type: `multipart/form-data`
- Supports up to 5 images with field name `images`

**Required Fields:**
- `phoneNumber`: User's phone number
- `startinglocation`: Starting location
- `goinglocation`: Destination location
- `recievername`: Receiver's name
- `recieverphone`: Receiver's phone number
- `Description`: Parcel description
- `weight`: Weight of the parcel
- `category`: Either "document" or "nondocument"
- `dateOfSending`: Date of sending (ISO format)
- `durationAtEndPoint`: Duration at endpoint

**Optional Fields:**
- `images`: Array of image files (up to 5)
- `dimensions`: JSON string with length, breadth, height, and unit
- `handleWithCare`: Boolean indicating if parcel needs special handling
- `specialRequest`: String for any special requests
- `travelMode`: Travel mode (defaults to "car")

**Response:**
```json
{
  "message": "Consignment created successfully",
  "consignment": {
    // Consignment object with all details including image URLs
  }
}
```

## Frontend Integration

The frontend should send the request as `multipart/form-data` with:
- Text fields as regular form data
- Images as file objects with field name `images`
- Dimensions as a JSON string

## Error Handling

- Validates all required fields
- Handles image upload errors gracefully
- Returns appropriate error messages for invalid data
- Supports up to 5 images per consignment

## Dependencies

- `multer`: For handling multipart form data
- `imagekit`: For cloud image storage
- `express-validator`: For request validation

All dependencies are already installed in the project. 