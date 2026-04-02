# KYC Verification Module

## Overview
Complete KYC (Know Your Customer) verification system with phone OTP verification, document upload, and admin approval workflow.

## Features Implemented

### Backend
1. **File Upload Handling**
   - Multer middleware for file uploads
   - Cloudinary integration for image storage
   - File validation (image types, 5MB limit)

2. **OTP Service**
   - 6-digit OTP generation
   - 5-minute expiration
   - Rate limiting (1 OTP per minute)

3. **SMS Service**
   - SMS sending framework (currently logs to console for development)
   - Ready for integration with SMS providers (Sparrow SMS, etc.)

4. **Secret Code Generation**
   - 8-character alphanumeric codes for auction access
   - Unique code generation per approved user

5. **KYC Routes**
   - `POST /api/kyc/upload-document` - Upload citizenship photo
   - `POST /api/kyc/send-otp` - Send OTP to phone
   - `POST /api/kyc/verify-otp` - Verify OTP code
   - `GET /api/kyc/status` - Get KYC status
   - `POST /api/kyc/citizenship-number` - Add citizenship number

6. **Admin Routes**
   - `GET /api/kyc/admin/pending` - Get pending KYCs
   - `GET /api/kyc/admin/all` - Get all KYCs with filters
   - `GET /api/kyc/admin/:kycId` - Get KYC details
   - `POST /api/kyc/admin/approve/:kycId` - Approve KYC
   - `POST /api/kyc/admin/reject/:kycId` - Reject KYC

### Frontend
1. **KYC Verification Page** (`/kyc-verification`)
   - 3-step verification process
   - Phone OTP verification
   - Document upload with preview
   - Citizenship number entry (optional)
   - Status tracking

2. **Admin KYC Management** (`/admin/kyc`)
   - View all KYC applications
   - Filter by status
   - View KYC details with document preview
   - Approve/Reject with reasons

## Workflow

1. **User Verification Flow:**
   - User requests OTP → Receives SMS → Verifies OTP
   - User uploads citizenship photo
   - (Optional) User adds citizenship number
   - Status changes to "Under Review"
   - Admin reviews and approves/rejects
   - If approved, user receives secret code and auction group link

2. **Admin Approval Flow:**
   - Admin views pending KYCs
   - Reviews citizenship document
   - Approves or rejects with reason
   - System generates secret code for approved users
   - User account updated with KYC status

## SMS Integration

Currently, OTP is logged to console for development. To integrate with actual SMS:

1. **Option 1: Sparrow SMS (Nepal)**
   - Sign up at sparrowsms.com
   - Get API token
   - Update `backend/utils/smsService.js` with Sparrow SMS API

2. **Option 2: Other SMS Providers**
   - Update the `sendOTP` function in `smsService.js`
   - Use your preferred SMS gateway API

## Installation

Backend dependencies:
```bash
cd backend
npm install multer cloudinary axios
```

## Environment Variables

Add to `backend/.env`:
```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Optional: SMS Service
SPARROW_SMS_TOKEN=your_sparrow_token
SPARROW_SMS_FROM=AuctionNepal
```

## Testing

1. **Development Mode:**
   - OTP is logged to console
   - Check console for OTP codes during testing

2. **File Upload:**
   - Upload citizenship photo (JPG, PNG)
   - Maximum 5MB file size
   - Preview before upload

3. **Admin Approval:**
   - Login as admin user
   - Navigate to `/admin/kyc`
   - Review and approve/reject applications

