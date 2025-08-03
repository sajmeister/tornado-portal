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

const arrTestUsers = [
  {
    strUsername: 'superadmin',
    strEmail: 'superadmin@tornado.com',
    strName: 'Super Administrator',
    strPassword: 'password123',
    strRole: 'super_admin'
  },
  {
    strUsername: 'provider',
    strEmail: 'provider@tornado.com',
    strName: 'Provider User',
    strPassword: 'password123',
    strRole: 'provider_user'
  },
  {
    strUsername: 'partneradmin',
    strEmail: 'partneradmin@tornado.com',
    strName: 'Partner Administrator',
    strPassword: 'password123',
    strRole: 'partner_admin'
  },
  {
    strUsername: 'partneruser',
    strEmail: 'partneruser@tornado.com',
    strName: 'Partner Customer',
    strPassword: 'password123',
    strRole: 'partner_customer'
  }
];

async function createRoleUsers() {
  try {
    console.log('🔧 Creating test users for all roles...\n');

    for (const objUserData of arrTestUsers) {
      const strUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const strPasswordHash = await bcrypt.hash(objUserData.strPassword, 12);

      // Check if user already exists
      const existingUser = await client.execute({
        sql: 'SELECT strUserId FROM tblUsers WHERE strUsername = ?',
        args: [objUserData.strUsername]
      });

      if (existingUser.rows.length > 0) {
        console.log(`⚠️  User "${objUserData.strUsername}" already exists!`);
        continue;
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
          objUserData.strUsername,
          objUserData.strEmail,
          objUserData.strName,
          strPasswordHash,
          objUserData.strRole,
          'local', // strProvider
          strUserId, // strProviderId
          1, // bIsActive = true
          Math.floor(Date.now() / 1000), // dtCreated
          Math.floor(Date.now() / 1000), // dtUpdated
        ]
      });

      console.log(`✅ Created user: ${objUserData.strUsername} (${objUserData.strRole})`);
    }

    console.log('\n🎉 All test users created successfully!');
    console.log('\n📝 Login credentials for all users:');
    console.log('   Password: password123');
    console.log('\n👥 Available users:');
    arrTestUsers.forEach(user => {
      console.log(`   • ${user.strUsername} - ${user.strRole}`);
    });
    console.log('\n🔗 You can now login at: http://localhost:3000/login');

  } catch (error) {
    console.error('❌ Error creating role users:', error.message);
    process.exit(1);
  }
}

// Run the script
createRoleUsers(); 