import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { tblPartnerUsers, tblUsers } from '@/src/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { fnGetUserPartnerId } from '@/src/lib/partners';

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
    
    // Check if user is a partner admin
    if (strUserRoleNonNull !== 'partner_admin') {
      return NextResponse.json({ 
        success: false, 
        error: 'Only partner admins can view customers' 
      }, { status: 403 });
    }

    // Get the user's partner ID
    const strPartnerId = await fnGetUserPartnerId(strUserIdNonNull);
    if (!strPartnerId) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not associated with any partner' 
      }, { status: 403 });
    }

    // Get partner customers with user details
    const arrPartnerCustomers = await db
      .select({
        strPartnerUserId: tblPartnerUsers.strPartnerUserId,
        strUserId: tblPartnerUsers.strUserId,
        strRole: tblPartnerUsers.strRole,
        dtCreated: tblPartnerUsers.dtCreated,
        // User details
        strUsername: tblUsers.strUsername,
        strEmail: tblUsers.strEmail,
        strName: tblUsers.strName,
      })
      .from(tblPartnerUsers)
      .innerJoin(tblUsers, eq(tblPartnerUsers.strUserId, tblUsers.strUserId))
      .where(and(
        eq(tblPartnerUsers.strPartnerId, strPartnerId),
        eq(tblPartnerUsers.strRole, 'partner_customer'),
        eq(tblPartnerUsers.bIsActive, true)
      ))
      .orderBy(tblUsers.strName);

    return NextResponse.json({ 
      success: true, 
      customers: arrPartnerCustomers 
    });

  } catch (error) {
    console.error('Error fetching partner customers:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 