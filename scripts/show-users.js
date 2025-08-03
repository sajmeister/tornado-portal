#!/usr/bin/env node

import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function showUsers() {
  try {
    console.log('👥 Current Users in Database:\n');

    // Get all users with their roles
    const usersResult = await client.execute(`
      SELECT strUserId, strUsername, strEmail, strName, strRole, bIsActive 
      FROM tblUsers 
      ORDER BY strRole, strName
    `);

    if (usersResult.rows.length === 0) {
      console.log('❌ No users found in the database.');
      return;
    }

    console.log('📋 Users by Role:\n');

    // Group users by role
    const usersByRole = {};
    usersResult.rows.forEach(row => {
      const role = row[4] || 'No Role';
      if (!usersByRole[role]) {
        usersByRole[role] = [];
      }
      usersByRole[role].push({
        id: row[0],
        username: row[1],
        email: row[2],
        name: row[3],
        active: row[5]
      });
    });

    // Display users by role
    Object.keys(usersByRole).forEach(role => {
      console.log(`🔹 ${role.toUpperCase()}:`);
      usersByRole[role].forEach(user => {
        const status = user.active ? '✅ Active' : '❌ Inactive';
        console.log(`   • ${user.name} (${user.username}) - ${user.email} - ${status}`);
      });
      console.log('');
    });

    // Show partner information
    console.log('🤝 Partners:\n');
    const partnersResult = await client.execute(`
      SELECT strPartnerId, strPartnerName, strPartnerCode, decDiscountRate, bIsActive 
      FROM tblPartners 
      ORDER BY strPartnerName
    `);

    if (partnersResult.rows.length > 0) {
      partnersResult.rows.forEach(row => {
        const status = row[4] ? '✅ Active' : '❌ Inactive';
        const discount = row[3] ? `${row[3]}%` : 'No discount';
        console.log(`🔹 ${row[1]} (${row[2]}) - ${discount} - ${status}`);
      });
    } else {
      console.log('❌ No partners found.');
    }

    console.log('\n💡 Test Partner Pricing:');
    console.log('   1. Login as a Partner Admin or Partner Customer');
    console.log('   2. Navigate to Products page');
    console.log('   3. You should see partner-specific pricing (discounted)');
    console.log('   4. You should NOT see edit/delete buttons');

  } catch (error) {
    console.error('❌ Error showing users:', error.message);
    process.exit(1);
  }
}

// Run the script
showUsers(); 