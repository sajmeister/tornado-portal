#!/usr/bin/env node

import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function addUsernameColumn() {
  try {
    console.log('🔧 Adding username column...\n');

    // Add username column without UNIQUE constraint first
    await client.execute('ALTER TABLE tblUsers ADD COLUMN strUsername TEXT');
    console.log('✅ Added strUsername column');

    // Now add UNIQUE constraint
    await client.execute('CREATE UNIQUE INDEX idx_users_username ON tblUsers(strUsername)');
    console.log('✅ Added UNIQUE index on strUsername');

    console.log('\n✅ Username column setup completed!');
    console.log('\n📝 You can now create a test user with: npm run db:create-user');

  } catch (error) {
    console.error('❌ Error adding username column:', error.message);
    process.exit(1);
  }
}

// Run the script
addUsernameColumn(); 