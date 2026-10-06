#!/usr/bin/env node

/**
 * Migration script to add 'departments' field to existing agents
 * Run with: node api/scripts/migrate-add-departments.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/LibreChat';

async function migrate() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected successfully!');

    const db = mongoose.connection.db;
    const agentsCollection = db.collection('agents');

    // Count agents without departments field
    const countWithoutDepartments = await agentsCollection.countDocuments({
      departments: { $exists: false },
    });

    console.log(`Found ${countWithoutDepartments} agents without 'departments' field`);

    if (countWithoutDepartments === 0) {
      console.log('All agents already have departments field. Nothing to migrate.');
      process.exit(0);
    }

    // Add empty departments array to all agents that don't have it
    const result = await agentsCollection.updateMany(
      { departments: { $exists: false } },
      { $set: { departments: [] } },
    );

    console.log(`✅ Migration completed!`);
    console.log(`   Updated ${result.modifiedCount} agents`);
    console.log(`   Matched ${result.matchedCount} agents`);

    // Verify migration
    const remainingWithoutDepartments = await agentsCollection.countDocuments({
      departments: { $exists: false },
    });

    if (remainingWithoutDepartments === 0) {
      console.log('✅ Verification: All agents now have departments field');
    } else {
      console.log(`⚠️  Warning: ${remainingWithoutDepartments} agents still missing departments field`);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

migrate();
