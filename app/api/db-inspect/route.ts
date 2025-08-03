import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

export async function GET() {
  try {
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });

    // Get list of all tables
    const tablesResult = await client.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    const tables = tablesResult.rows.map(row => row[0] as string);
    
    const dbInfo: any = {
      databaseUrl: process.env.TURSO_DATABASE_URL,
      totalTables: tables.length,
      tables: []
    };

    // For each table, get its structure and sample data
    for (const tableName of tables) {
      try {
        // Get table schema
        const schemaResult = await client.execute(`PRAGMA table_info(${tableName})`);
        const columns = schemaResult.rows.map(row => ({
          name: row[1] as string,
          type: row[2] as string,
          notNull: Boolean(row[3]),
          primaryKey: Boolean(row[5])
        }));

        // Get row count
        const countResult = await client.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
        const rowCount = countResult.rows[0]?.[0] as number || 0;

        // Get sample data (first 5 rows)
        const sampleResult = await client.execute(`SELECT * FROM ${tableName} LIMIT 5`);
        
        const tableInfo = {
          name: tableName,
          columns: columns,
          rowCount: rowCount,
          sampleData: sampleResult.rows,
          columnNames: sampleResult.columns
        };

        dbInfo.tables.push(tableInfo);
      } catch (error) {
        dbInfo.tables.push({
          name: tableName,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Database inspection completed',
      data: dbInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Database inspection error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Database inspection failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 