#!/usr/bin/env node
/**
 * Script to change user password from command line
 * Usage: node scripts/change-user-password.js user@email.com newPassword123
 */

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.error('Usage: node change-user-password.js <email> <newPassword>');
  console.error('Example: node change-user-password.js user@example.com tempPass123!');
  process.exit(1);
}

if (newPassword.length < 8) {
  console.error('❌ Password must be at least 8 characters');
  process.exit(1);
}

async function changePassword() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/LibreChat');

    // Get User model
    const User = mongoose.model('User');

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await User.updateOne(
      { _id: user._id },
      { $set: { password: hashedPassword } }
    );

    console.log(`✅ Password updated successfully for ${email}`);
    console.log(`New password: ${newPassword}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

changePassword();
