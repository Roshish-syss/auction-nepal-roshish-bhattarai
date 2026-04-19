const mongoose = require('mongoose');
const User = require('../models/User');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });


const createAdmin = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      console.error('Error: MONGODB_URI not found in .env file');
      process.exit(1);
    }

    const options = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };
    const dbName = process.env.MONGODB_DB_NAME?.trim();
    if (dbName) options.dbName = dbName;

    await mongoose.connect(mongoURI, options);
    console.log('MongoDB Connected');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@auctionnepal.com' });
    
    if (existingAdmin) {
      if (existingAdmin.role === 'admin') {
        console.log('Admin user already exists with email: admin@auctionnepal.com');
        console.log('Updating admin credentials...');
        
        // Update password
        existingAdmin.password = 'Admin@auction1';
        existingAdmin.fullName = existingAdmin.fullName || 'System';
        existingAdmin.phoneNumber = existingAdmin.phoneNumber || '0000000000';
        existingAdmin.role = 'admin';
        
        // Save will trigger password hashing via pre-save hook
        await existingAdmin.save();
        
        console.log('✅ Admin user updated successfully!');
        console.log('Email: admin@auctionnepal.com');
        console.log('Password: Admin@auction1');
      } else {
        console.log('User exists but is not an admin. Updating role...');
        existingAdmin.role = 'admin';
        existingAdmin.password = 'Admin@auction1';
        await existingAdmin.save();
        console.log('✅ User role updated to admin!');
      }
    } else {
      // Create new admin user
      const adminUser = new User({
        fullName: 'System',
        email: 'admin@auctionnepal.com',
        phoneNumber: '0000000000', // Default phone number
        password: 'Admin@auction1', // Will be hashed by pre-save hook
        role: 'admin',
        kycVerified: true, // Admin doesn't need KYC
        depositEligible: true,
        agreedToTerms: true,
        agreedToTermsAt: new Date()
      });

      await adminUser.save();
      console.log('✅ Admin user created successfully!');
      console.log('Email: admin@auctionnepal.com');
      console.log('Password: Admin@auction1');
    }

    // Verify the admin was created/updated
    const admin = await User.findOne({ email: 'admin@auctionnepal.com' });
    console.log('\n📋 Admin Details:');
    console.log(`ID: ${admin._id}`);
    console.log(`Name: ${admin.fullName}`);
    console.log(`Email: ${admin.email}`);
    console.log(`Role: ${admin.role}`);
    console.log(`Created: ${admin.createdAt}`);

    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  }
};

// Run the script
createAdmin();

