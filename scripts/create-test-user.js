#!/usr/bin/env node

import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function createTestUser() {
  try {
    console.log('🔧 Creating test user...\n');

    const strUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const strUsername = 'admin';
    const strEmail = 'admin@tornado.com';
    const strName = 'Admin User';
    const strPassword = 'password123';
    const strRole = 'admin';

    // Hash the password
    const strPasswordHash = await bcrypt.hash(strPassword, 12);

    // Check if user already exists
    const existingUser = await client.execute({
      sql: 'SELECT strUserId FROM tblUsers WHERE strUsername = ?',
      args: [strUsername]
    });

    if (existingUser.rows.length > 0) {
      console.log('⚠️  User "admin" already exists!');
      console.log('📝 Login credentials:');
      console.log('   Username: admin');
      console.log('   Password: password123');
      return;
    }

    // Insert the test user
    await client.execute({
      sql: `
        INSERT INTO tblUsers (
          strUserId, strUsername, strEmail, strName, strPasswordHash, 
          strRole, strProvider, strProviderId, bIsActive, dtCreated, dtUpdated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        strUserId,
        strUsername,
        strEmail,
        strName,
        strPasswordHash,
        strRole,
        'local', // strProvider
        strUserId, // strProviderId (using userId as provider ID for local auth)
        1, // bIsActive = true
        Math.floor(Date.now() / 1000), // dtCreated
        Math.floor(Date.now() / 1000), // dtUpdated
      ]
    });

    console.log('✅ Test user created successfully!');
    console.log('\n📝 Login credentials:');
    console.log('   Username: admin');
    console.log('   Password: password123');
    console.log('   Role: admin');
    console.log('\n🔗 You can now login at: http://localhost:3000/login');

  } catch (error) {
    console.error('❌ Error creating test user:', error.message);
    process.exit(1);
  }
}

// Run the script
createTestUser(); 