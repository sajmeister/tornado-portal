import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { tblUsers, tblPartnerUsers } from '@/src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { EUserRole } from '@/src/lib/roles';

// GET /api/users/orphaned - Get users who are not associated with any partner
export async function GET(request: NextRequest) {
  try {
    // Get user info from middleware headers
    const strUserId = request.headers.get('x-user-id');
    const strUserRole = request.headers.get('x-user-role');
    
    if (!strUserId || !strUserRole) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    
    const strUserRoleNonNull = strUserRole as string;

    // Only Super Admins can view orphaned users
    if (strUserRoleNonNull !== EUserRole.SUPER_ADMIN) {
      return NextResponse.json({ 
        success: false, 
        error: 'Insufficient permissions. Only Super Admins can view orphaned users.' 
      }, { status: 403 });
    }

    // Get all active users
    const arrAllUsers = await db
      .select({
        strUserId: tblUsers.strUserId,
        strUsername: tblUsers.strUsername,
        strEmail: tblUsers.strEmail,
        strName: tblUsers.strName,
        strRole: tblUsers.strRole,
        bIsActive: tblUsers.bIsActive,
        dtCreated: tblUsers.dtCreated,
        dtUpdated: tblUsers.dtUpdated,
      })
      .from(tblUsers)
      .where(eq(tblUsers.bIsActive, true));

    // Get all active partner user associations
    const arrPartnerUsers = await db
      .select({
        strUserId: tblPartnerUsers.strUserId,
      })
      .from(tblPartnerUsers)
      .where(eq(tblPartnerUsers.bIsActive, true));

    // Create a set of user IDs that are associated with partners
    const setAssociatedUserIds = new Set(arrPartnerUsers.map(pu => pu.strUserId));

    // Filter out users who are associated with partners OR belong to Provider organization
    // Provider organization users (super_admin, provider_user) should not be considered orphaned
    const arrOrphanedUsers = arrAllUsers.filter(user => {
      // Skip users who are associated with partners
      if (setAssociatedUserIds.has(user.strUserId)) {
        return false;
      }
      
      // Skip users who belong to Provider organization (super_admin, provider_user)
      if (user.strRole === 'super_admin' || user.strRole === 'provider_user') {
        return false;
      }
      
      // Only include users who are not associated with partners AND don't belong to Provider organization
      return true;
    });

    return NextResponse.json({ 
      success: true, 
      users: arrOrphanedUsers,
      count: arrOrphanedUsers.length
    });

  } catch (error) {
    console.error('Error fetching orphaned users:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 