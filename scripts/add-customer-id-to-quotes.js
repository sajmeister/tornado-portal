#!/usr/bin/env node

import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function addCustomerIdToQuotes() {
  try {
    console.log('🔄 Adding strCustomerId column to tblQuotes table...');
    
    // Check if the column already exists
    const schemaResult = await client.execute(`PRAGMA table_info(tblQuotes)`);
    const existingColumns = schemaResult.rows.map(row => row[1]);
    
    if (existingColumns.includes('strCustomerId')) {
      console.log('ℹ️  strCustomerId column already exists in tblQuotes table');
      return;
    }
    
    // Add the strCustomerId column to tblQuotes table
    await client.execute(`
      ALTER TABLE tblQuotes 
      ADD COLUMN strCustomerId TEXT
    `);
    
    console.log('✅ Successfully added strCustomerId column to tblQuotes table');
    console.log('ℹ️  Existing quotes will have strCustomerId as NULL (optional field)');
    
  } catch (error) {
    console.error('❌ Error adding strCustomerId column:', error);
    throw error;
  }
}

// Run the migration
addCustomerIdToQuotes()
  .then(() => {
    console.log('🎉 Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }); 