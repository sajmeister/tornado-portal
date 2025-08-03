import { NextResponse } from 'next/server';
import { db } from '../../../src/lib/db';
import { tblUsers } from '../../../src/lib/db/schema';

export async function GET() {
  try {
    // Test the database connection by running a simple query
    const result = await db.select().from(tblUsers).limit(1);
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database connection error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 