import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { tblPartnerUsers, tblPartners } from '@/src/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { EUserRole } from '@/src/lib/roles';

// GET /api/auth/me/partner - Get current user's partner information
export async function GET(request: NextRequest) {
  try {
    // Get user info from middleware headers
    const strUserId = request.headers.get('x-user-id');
    const strUserRole = request.headers.get('x-user-role');
    
    if (!strUserId || !strUserRole) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    
    const strUserIdNonNull = strUserId as string;
    const strUserRoleNonNull = strUserRole as string;
    
    // Only partner admins need this endpoint
    if (strUserRoleNonNull !== EUserRole.PARTNER_ADMIN) {
      return NextResponse.json({ 
        success: false, 
        error: 'This endpoint is only for partner admins' 
      }, { status: 403 });
    }

    // Get user's partner through tblPartnerUsers
    const arrPartnerUsers = await db
      .select({
        strPartnerUserId: tblPartnerUsers.strPartnerUserId,
        strPartnerId: tblPartnerUsers.strPartnerId,
        strRole: tblPartnerUsers.strRole,
        dtCreated: tblPartnerUsers.dtCreated,
        dtUpdated: tblPartnerUsers.dtUpdated,
        bIsActive: tblPartnerUsers.bIsActive,
      })
      .from(tblPartnerUsers)
      .where(and(
        eq(tblPartnerUsers.strUserId, strUserIdNonNull),
        eq(tblPartnerUsers.bIsActive, true)
      ))
      .limit(1);

    if (arrPartnerUsers.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not associated with any partner' 
      }, { status: 404 });
    }

    const objPartnerUser = arrPartnerUsers[0];

    // Get partner details
    const arrPartners = await db
      .select()
      .from(tblPartners)
      .where(and(
        eq(tblPartners.strPartnerId, objPartnerUser.strPartnerId),
        eq(tblPartners.bIsActive, true)
      ))
      .limit(1);

    if (arrPartners.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Partner not found' 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      partnerUser: objPartnerUser,
      partner: arrPartners[0]
    });

  } catch (error) {
    console.error('Error fetching user partner info:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 