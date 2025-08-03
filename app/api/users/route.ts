import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { tblUsers } from '@/src/lib/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/users - Get all users (for partner user management)
export async function GET(request: NextRequest) {
  try {
    // Get user info from middleware headers
    const strUserRole = request.headers.get('x-user-role');
    
    if (!strUserRole) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    
    const strUserRoleNonNull = strUserRole as string;

    // Only super_admin and partner_admin can view users for partner management
    if (!['super_admin', 'partner_admin'].includes(strUserRoleNonNull)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Insufficient permissions' 
      }, { status: 403 });
    }

    // Get all active users
    const arrUsers = await db
      .select({
        strUserId: tblUsers.strUserId,
        strUsername: tblUsers.strUsername,
        strEmail: tblUsers.strEmail,
        strName: tblUsers.strName,
        strRole: tblUsers.strRole,
        bIsActive: tblUsers.bIsActive,
      })
      .from(tblUsers)
      .where(eq(tblUsers.bIsActive, true))
      .orderBy(tblUsers.strName);

    return NextResponse.json({ 
      success: true, 
      users: arrUsers 
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 