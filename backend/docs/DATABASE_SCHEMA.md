# AuctionNepal Database Schema Documentation

## Overview
This document describes the database schema for the AuctionNepal platform. All models use MongoDB with Mongoose ODM.

## Models

### 1. User Model
**Collection:** `users`

Stores user account information, authentication data, and profile details.

**Fields:**
- `fullName` (String, required): User's full name
- `email` (String, required, unique): User's email address
- `phoneNumber` (String, required): 10-digit phone number
- `password` (String, required): Hashed password (bcrypt)
- `role` (String, enum: 'user'|'admin', default: 'user'): User role
- `kycVerified` (Boolean, default: false): KYC verification status
- `kycData` (Object): KYC-related data
  - `citizenshipPhoto` (String): URL to citizenship photo
  - `phoneVerified` (Boolean): Phone verification status
  - `adminApproved` (Boolean): Admin approval status
- `depositEligible` (Boolean, default: false): Deposit eligibility status
- `depositData` (Object): Deposit-related information
  - `amount` (Number): Deposit amount
  - `paymentProof` (String): Payment proof URL
  - `status` (String, enum): Deposit status
  - `refundStatus` (String, enum): Refund status
- `secretCode` (String): Unique secret code for auction access
- `auctionGroupLink` (String): Link to auction group
- `createdAt` (Date): Account creation timestamp
- `updatedAt` (Date): Last update timestamp

**Indexes:**
- `email` (unique)
- `phoneNumber`

**Methods:**
- `comparePassword(candidatePassword)`: Compare password with hash

---

### 2. Property Model
**Collection:** `properties`

Stores property listing information.

**Fields:**
- `title` (String, required): Property title
- `description` (String, required): Property description
- `location` (Object, required): Location details
  - `address` (String, required)
  - `city` (String, required)
  - `district` (String)
  - `province` (String)
  - `coordinates` (Object): Latitude and longitude
- `type` (String, enum, required): Property type
  - Options: 'house', 'apartment', 'villa', 'land', 'commercial'
- `specifications` (Object): Property specifications
  - `bedrooms` (Number)
  - `bathrooms` (Number)
  - `area` (Number, required)
  - `areaUnit` (String, enum): 'sqft', 'sqm', 'aana', 'ropani'
  - `floors` (Number)
  - `parking` (Boolean)
  - `furnishing` (String, enum): 'furnished', 'semi-furnished', 'unfurnished'
- `photos` (Array): Property photos
  - `url` (String, required)
  - `caption` (String)
  - `isPrimary` (Boolean)
- `documents` (Array): Property documents
  - `name` (String)
  - `url` (String)
  - `type` (String, enum): Document type
- `basePrice` (Number, required): Base/starting price
- `depositAmount` (Number, required): Required deposit amount
- `auctionTime` (Date, required): Scheduled auction time
- `auctionDuration` (Number, default: 60): Duration in minutes
- `status` (String, enum, default: 'draft'): Property status
  - Options: 'draft', 'upcoming', 'live', 'completed', 'cancelled'
- `ownerId` (ObjectId, ref: 'User', required): Property owner
- `listedBy` (ObjectId, ref: 'User', required): User who listed the property
- `createdBy` (ObjectId, ref: 'User', required): Admin who created listing
- `views` (Number, default: 0): View count
- `featured` (Boolean, default: false): Featured property flag
- `createdAt` (Date): Creation timestamp
- `updatedAt` (Date): Update timestamp

**Indexes:**
- `status` + `auctionTime` (compound)
- `ownerId`
- `location.city`
- `type`
- `featured` + `status` (compound)
- `createdAt` (descending)

---

### 3. Auction Model
**Collection:** `auctions`

Manages live auction sessions.

**Fields:**
- `propertyId` (ObjectId, ref: 'Property', required, unique): Associated property
- `currentBid` (Number, default: 0): Current highest bid
- `highestBidder` (ObjectId, ref: 'User'): User with highest bid
- `startingBid` (Number, required): Starting bid amount
- `bidIncrement` (Number, default: 1000): Minimum bid increment
- `status` (String, enum, default: 'scheduled'): Auction status
  - Options: 'scheduled', 'live', 'paused', 'completed', 'cancelled'
- `startTime` (Date, required): Auction start time
- `endTime` (Date, required): Scheduled end time
- `actualEndTime` (Date): Actual end time
- `participants` (Array): Auction participants
  - `userId` (ObjectId, ref: 'User')
  - `joinedAt` (Date)
  - `depositPaid` (Boolean)
- `totalBids` (Number, default: 0): Total number of bids
- `winner` (Object): Winner information
  - `userId` (ObjectId, ref: 'User')
  - `winningBid` (Number)
  - `finalizedAt` (Date)
  - `paymentStatus` (String, enum): 'pending', 'completed', 'failed', 'refunded'
- `secretCode` (String, required, unique): Secret code for access
- `groupLink` (String): Group chat/link URL
- `createdAt` (Date): Creation timestamp
- `updatedAt` (Date): Update timestamp

**Indexes:**
- `propertyId` (unique)
- `status` + `startTime` (compound)
- `participants.userId`
- `highestBidder`
- `secretCode` (unique)

**Methods:**
- `isLive()`: Check if auction is currently live
- `hasEnded()`: Check if auction has ended

---

### 4. Bid Model
**Collection:** `bids`

Stores all bid records for auctions.

**Fields:**
- `auctionId` (ObjectId, ref: 'Auction', required): Associated auction
- `propertyId` (ObjectId, ref: 'Property', required): Associated property
- `userId` (ObjectId, ref: 'User', required): Bidder
- `bidAmount` (Number, required): Bid amount
- `previousBid` (Number): Previous bid amount
- `isWinningBid` (Boolean, default: false): Whether this is the winning bid
- `status` (String, enum, default: 'pending'): Bid status
  - Options: 'pending', 'accepted', 'outbid', 'winning', 'invalid'
- `ipAddress` (String): IP address of bidder
- `userAgent` (String): User agent string
- `flagged` (Boolean, default: false): Fraud detection flag
- `flagReason` (String): Reason for flagging
- `timestamp` (Date, required): Bid timestamp

**Indexes:**
- `auctionId` + `timestamp` (compound, descending)
- `userId`
- `propertyId`
- `timestamp` (descending)
- `status`
- `isWinningBid` + `auctionId` (compound)
- `userId` + `auctionId` + `timestamp` (compound)

---

### 5. Deposit Model
**Collection:** `deposits`

Manages user deposits for auction participation.

**Fields:**
- `userId` (ObjectId, ref: 'User', required): Depositor
- `auctionId` (ObjectId, ref: 'Auction', required): Associated auction
- `propertyId` (ObjectId, ref: 'Property', required): Associated property
- `amount` (Number, required): Deposit amount
- `paymentMethod` (String, enum, required): 'esewa' or 'khalti'
- `transactionId` (String): Payment gateway transaction ID
- `paymentProof` (Object, required): Payment proof
  - `url` (String, required)
  - `uploadedAt` (Date)
- `phoneNumber` (String, required): Payment phone number
- `status` (String, enum, default: 'pending'): Deposit status
  - Options: 'pending', 'verified', 'approved', 'rejected', 'refunded'
- `verifiedBy` (ObjectId, ref: 'User'): Admin who verified
- `verifiedAt` (Date): Verification timestamp
- `rejectionReason` (String): Rejection reason if rejected
- `refundStatus` (String, enum, default: 'none'): Refund status
  - Options: 'none', 'pending', 'processing', 'completed', 'failed'
- `refundAmount` (Number): Refund amount
- `refundTransactionId` (String): Refund transaction ID
- `refundedAt` (Date): Refund timestamp
- `refundReason` (String): Reason for refund
- `createdAt` (Date): Creation timestamp
- `updatedAt` (Date): Update timestamp

**Indexes:**
- `userId`
- `auctionId`
- `propertyId`
- `status`
- `refundStatus`
- `transactionId`
- `createdAt` (descending)
- `userId` + `auctionId` (compound, unique)

---

### 6. KYC Model
**Collection:** `kycs`

Manages KYC (Know Your Customer) verification records.

**Fields:**
- `userId` (ObjectId, ref: 'User', required, unique): User reference
- `citizenshipPhoto` (Object, required): Citizenship document
  - `url` (String, required)
  - `uploadedAt` (Date)
  - `verified` (Boolean)
- `citizenshipNumber` (String): Citizenship number
- `phoneNumber` (String, required): Phone number for verification
- `phoneVerified` (Boolean, default: false): Phone verification status
- `otpCode` (String): OTP code for verification
- `otpExpiresAt` (Date): OTP expiration time
- `otpVerifiedAt` (Date): OTP verification timestamp
- `adminApproved` (Boolean, default: false): Admin approval status
- `approvedBy` (ObjectId, ref: 'User'): Admin who approved
- `approvedAt` (Date): Approval timestamp
- `rejectionReason` (String): Rejection reason
- `rejectedBy` (ObjectId, ref: 'User'): Admin who rejected
- `rejectedAt` (Date): Rejection timestamp
- `status` (String, enum, default: 'pending'): KYC status
  - Options: 'pending', 'phone_verified', 'document_uploaded', 'under_review', 'approved', 'rejected'
- `verificationAttempts` (Number, default: 0): Verification attempt count
- `lastVerificationAttempt` (Date): Last attempt timestamp
- `createdAt` (Date): Creation timestamp
- `updatedAt` (Date): Update timestamp

**Indexes:**
- `userId` (unique)
- `phoneNumber`
- `status`
- `adminApproved`
- `createdAt` (descending)

**Methods:**
- `isComplete()`: Check if KYC is fully complete

---

### 7. Chat Model
**Collection:** `chats`

Stores chat messages between users.

**Fields:**
- `senderId` (ObjectId, ref: 'User', required): Message sender
- `receiverId` (ObjectId, ref: 'User', required): Message receiver
- `message` (String, required, max: 1000): Message content
- `messageType` (String, enum, default: 'text'): Message type
  - Options: 'text', 'image', 'file', 'system'
- `attachments` (Array): File attachments
  - `url` (String)
  - `type` (String)
  - `name` (String)
  - `size` (Number)
- `read` (Boolean, default: false): Read status
- `readAt` (Date): Read timestamp
- `timestamp` (Date, required): Message timestamp
- `deleted` (Boolean, default: false): Deletion status
- `deletedAt` (Date): Deletion timestamp

**Indexes:**
- `senderId` + `receiverId` + `timestamp` (compound, descending)
- `receiverId` + `read` + `timestamp` (compound)
- `timestamp` (descending)
- `senderId` + `timestamp`
- `receiverId` + `timestamp`

---

### 8. Rental Model
**Collection:** `rentals`

Manages property rental listings.

**Fields:**
- `propertyId` (ObjectId, ref: 'Property', required): Rented property
- `ownerId` (ObjectId, ref: 'User', required): Property owner
- `tenantId` (ObjectId, ref: 'User'): Current tenant
- `monthlyRent` (Number, required): Monthly rent amount
- `securityDeposit` (Number, default: 0): Security deposit
- `availability` (String, enum, default: 'available'): Availability status
  - Options: 'available', 'rented', 'unavailable'
- `leaseStartDate` (Date): Lease start date
- `leaseEndDate` (Date): Lease end date
- `leaseDuration` (Number): Lease duration in months
- `description` (String): Rental description
- `requirements` (Object): Tenant requirements
  - `minAge` (Number)
  - `maxAge` (Number)
  - `gender` (String, enum): 'male', 'female', 'any'
  - `employment` (String, enum): 'required', 'preferred', 'not_required'
- `amenities` (Array): Available amenities
- `applications` (Array): Rental applications
  - `userId` (ObjectId, ref: 'User')
  - `appliedAt` (Date)
  - `status` (String, enum): 'pending', 'accepted', 'rejected'
  - `message` (String)
- `status` (String, enum, default: 'active'): Rental status
  - Options: 'active', 'inactive', 'archived'
- `views` (Number, default: 0): View count
- `createdAt` (Date): Creation timestamp
- `updatedAt` (Date): Update timestamp

**Indexes:**
- `ownerId`
- `tenantId`
- `propertyId`
- `availability` + `status` (compound)
- `monthlyRent`
- `createdAt` (descending)
- `status` + `availability` (compound)

---

## Relationships

### User Relationships
- One-to-Many: User → Properties (owner)
- One-to-Many: User → Bids
- One-to-Many: User → Deposits
- One-to-One: User → KYC
- One-to-Many: User → Chats (as sender/receiver)
- One-to-Many: User → Rentals (as owner/tenant)

### Property Relationships
- One-to-One: Property → Auction
- One-to-Many: Property → Bids
- One-to-Many: Property → Deposits
- One-to-One: Property → Rental

### Auction Relationships
- One-to-One: Auction → Property
- One-to-Many: Auction → Bids
- One-to-Many: Auction → Deposits
- Many-to-Many: Auction ↔ Users (participants)

---

## Index Strategy

### Performance Considerations
1. **Frequently queried fields** are indexed for fast lookups
2. **Compound indexes** are used for common query patterns
3. **Unique indexes** prevent duplicate entries
4. **Timestamp indexes** (descending) for chronological ordering

### Index Usage Patterns
- User lookups: `email`, `phoneNumber`
- Property searches: `status`, `type`, `city`, `featured`
- Auction queries: `status + startTime`, `propertyId`
- Bid tracking: `auctionId + timestamp`, `userId + auctionId`
- KYC verification: `status`, `adminApproved`
- Chat conversations: `senderId + receiverId + timestamp`

---

## Notes

1. **Admin Model**: Admin functionality is handled through the User model with `role: 'admin'`. No separate Admin model is required.

2. **Soft Deletes**: Some models (like Chat) support soft deletes using `deleted` flag for data retention.

3. **Timestamps**: All models use Mongoose `timestamps: true` for automatic `createdAt` and `updatedAt` fields.

4. **References**: All ObjectId references use Mongoose `ref` for population queries.

5. **Validation**: All required fields and enums are validated at the schema level.

---

## Version History
- **v1.0** - Initial schema design (2024)

