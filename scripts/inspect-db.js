#!/usr/bin/env node

import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function inspectDatabase() {
  try {
    console.log('🔍 Inspecting Turso Database...\n');
    console.log(`Database URL: ${process.env.TURSO_DATABASE_URL}\n`);

    // Get list of all tables
    const tablesResult = await client.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    const tables = tablesResult.rows.map(row => row[0]);
    
    console.log(`📊 Found ${tables.length} tables:\n`);

    if (tables.length === 0) {
      console.log('❌ No tables found in the database.');
      console.log('💡 You may need to create tables first using your schema.');
      return;
    }

    // For each table, get its structure and data
    for (const tableName of tables) {
      console.log(`\n📋 Table: ${tableName}`);
      console.log('─'.repeat(50));

      try {
        // Get table schema
        const schemaResult = await client.execute(`PRAGMA table_info(${tableName})`);
        console.log('\n📝 Schema:');
        schemaResult.rows.forEach(row => {
          const name = row[1];
          const type = row[2];
          const notNull = row[3] ? 'NOT NULL' : '';
          const primaryKey = row[5] ? 'PRIMARY KEY' : '';
          console.log(`  ${name} (${type}) ${notNull} ${primaryKey}`.trim());
        });

        // Get row count
        const countResult = await client.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
        const rowCount = countResult.rows[0]?.[0] || 0;
        console.log(`\n📈 Row count: ${rowCount}`);

        if (rowCount > 0) {
          // Get sample data
          const sampleResult = await client.execute(`SELECT * FROM ${tableName} LIMIT 3`);
          console.log('\n📄 Sample data:');
          
          if (sampleResult.columns && sampleResult.rows.length > 0) {
            // Print column headers
            console.log('  ' + sampleResult.columns.join(' | '));
            console.log('  ' + '─'.repeat(sampleResult.columns.join(' | ').length));
            
            // Print sample rows
            sampleResult.rows.forEach(row => {
              const formattedRow = row.map(cell => 
                cell === null ? 'NULL' : String(cell)
              );
              console.log('  ' + formattedRow.join(' | '));
            });
          }
        } else {
          console.log('\n📄 No data found in this table.');
        }

      } catch (error) {
        console.log(`❌ Error inspecting table ${tableName}: ${error.message}`);
      }
    }

    console.log('\n✅ Database inspection completed!');

  } catch (error) {
    console.error('❌ Database inspection failed:', error.message);
    process.exit(1);
  }
}

// Run the inspection
inspectDatabase(); 