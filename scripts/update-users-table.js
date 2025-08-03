#!/usr/bin/env node

import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function updateUsersTable() {
  try {
    console.log('🔧 Updating tblUsers table...\n');

    // Add missing columns to tblUsers table
    const arrAlterQueries = [
      'ALTER TABLE tblUsers ADD COLUMN strUsername TEXT UNIQUE',
      'ALTER TABLE tblUsers ADD COLUMN strPasswordHash TEXT',
      'ALTER TABLE tblUsers ADD COLUMN strRole TEXT DEFAULT "user"',
      'ALTER TABLE tblUsers ADD COLUMN dtLastLogin INTEGER',
    ];

    for (const strQuery of arrAlterQueries) {
      try {
        await client.execute(strQuery);
        console.log(`✅ Executed: ${strQuery}`);
      } catch (error) {
        if (error.message.includes('duplicate column name')) {
          console.log(`⚠️  Column already exists: ${strQuery}`);
        } else {
          console.log(`❌ Error: ${strQuery} - ${error.message}`);
        }
      }
    }

    console.log('\n✅ Users table update completed!');
    console.log('\n📝 You can now create a test user with: npm run db:create-user');

  } catch (error) {
    console.error('❌ Error updating users table:', error.message);
    process.exit(1);
  }
}

// Run the script
updateUsersTable(); 