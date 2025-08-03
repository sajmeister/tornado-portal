import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { tblPartnerUsers, tblPartners, tblUsers } from '@/src/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { EUserRole } from '@/src/lib/roles';

// GET /api/partners/[partnerId]/users - Get partner users
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { partnerId: strPartnerId } = await params;
  try {
    
    // Get user info from middleware headers
    const strUserId = request.headers.get('x-user-id');
    const strUserRole = request.headers.get('x-user-role');
    
    if (!strUserId || !strUserRole) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    
    const strUserIdNonNull = strUserId as string;
    const strUserRoleNonNull = strUserRole as string;
    
    // Check if user has permission to view partner users
    if (!['super_admin', 'partner_admin'].includes(strUserRoleNonNull)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Insufficient permissions' 
      }, { status: 403 });
    }

    // For partner admins, check if they belong to this partner
    if (strUserRoleNonNull === EUserRole.PARTNER_ADMIN) {
      const arrPartnerUsers = await db
        .select()
        .from(tblPartnerUsers)
        .where(and(
          eq(tblPartnerUsers.strUserId, strUserIdNonNull),
          eq(tblPartnerUsers.strPartnerId, strPartnerId),
          eq(tblPartnerUsers.bIsActive, true)
        ))
        .limit(1);

      if (arrPartnerUsers.length === 0) {
        return NextResponse.json({ 
          success: false, 
          error: 'Access denied' 
        }, { status: 403 });
      }
    }

    // Get partner users with user details
    const arrPartnerUsers = await db
      .select({
        strPartnerUserId: tblPartnerUsers.strPartnerUserId,
        strUserId: tblPartnerUsers.strUserId,
        strPartnerId: tblPartnerUsers.strPartnerId,
        strRole: tblPartnerUsers.strRole,
        dtCreated: tblPartnerUsers.dtCreated,
        dtUpdated: tblPartnerUsers.dtUpdated,
        bIsActive: tblPartnerUsers.bIsActive,
        // User details
        strUsername: tblUsers.strUsername,
        strEmail: tblUsers.strEmail,
        strName: tblUsers.strName,
      })
      .from(tblPartnerUsers)
      .innerJoin(tblUsers, eq(tblPartnerUsers.strUserId, tblUsers.strUserId))
      .where(and(
        eq(tblPartnerUsers.strPartnerId, strPartnerId),
        eq(tblPartnerUsers.bIsActive, true)
      ))
      .orderBy(tblUsers.strName);

    return NextResponse.json({ 
      success: true, 
      users: arrPartnerUsers 
    });

  } catch (error) {
    console.error('Error fetching partner users:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// POST /api/partners/[partnerId]/users - Add user to partner
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { partnerId: strPartnerId } = await params;
  try {
    
    // Get user info from middleware headers
    const strUserId = request.headers.get('x-user-id');
    const strUserRole = request.headers.get('x-user-role');
    
    if (!strUserId || !strUserRole) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    
    const strUserIdNonNull = strUserId as string;
    const strUserRoleNonNull = strUserRole as string;

    // Check if user has permission to manage partner users
    if (!['super_admin', 'partner_admin'].includes(strUserRoleNonNull)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Insufficient permissions' 
      }, { status: 403 });
    }

    // For partner admins, check if they belong to this partner
    if (strUserRoleNonNull === EUserRole.PARTNER_ADMIN) {
      const arrPartnerUsers = await db
        .select()
        .from(tblPartnerUsers)
        .where(and(
          eq(tblPartnerUsers.strUserId, strUserIdNonNull),
          eq(tblPartnerUsers.strPartnerId, strPartnerId),
          eq(tblPartnerUsers.bIsActive, true)
        ))
        .limit(1);

      if (arrPartnerUsers.length === 0) {
        return NextResponse.json({ 
          success: false, 
          error: 'Access denied. You can only manage users in your own partner organization.' 
        }, { status: 403 });
      }
    }

    const objBody = await request.json();
    const { strUserId: strTargetUserId, strRole } = objBody;

    // Validate required fields
    if (!strTargetUserId || !strRole) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID and role are required' 
      }, { status: 400 });
    }

    // Validate role
    if (!['partner_user', 'partner_admin'].includes(strRole)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid role' 
      }, { status: 400 });
    }

    // Check if partner exists
    const arrPartner = await db
      .select()
      .from(tblPartners)
      .where(and(
        eq(tblPartners.strPartnerId, strPartnerId),
        eq(tblPartners.bIsActive, true)
      ))
      .limit(1);

    if (arrPartner.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Partner not found' 
      }, { status: 404 });
    }

    // Check if user exists
    const arrUser = await db
      .select()
      .from(tblUsers)
      .where(eq(tblUsers.strUserId, strTargetUserId))
      .limit(1);

    if (arrUser.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    // Check if user is already associated with this partner
    const arrExistingPartnerUser = await db
      .select()
      .from(tblPartnerUsers)
      .where(and(
        eq(tblPartnerUsers.strUserId, strTargetUserId),
        eq(tblPartnerUsers.strPartnerId, strPartnerId),
        eq(tblPartnerUsers.bIsActive, true)
      ))
      .limit(1);

    if (arrExistingPartnerUser.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'User is already associated with this partner' 
      }, { status: 409 });
    }

    // Create partner user association
    const strPartnerUserId = `partner_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const dtNow = new Date();

    const arrNewPartnerUser = await db
      .insert(tblPartnerUsers)
      .values({
        strPartnerUserId,
        strUserId: strTargetUserId,
        strPartnerId,
        strRole,
        dtCreated: dtNow,
        dtUpdated: dtNow,
        bIsActive: true,
      })
      .returning();

    return NextResponse.json({ 
      success: true, 
      partnerUser: arrNewPartnerUser[0] 
    }, { status: 201 });

  } catch (error) {
    console.error('Error adding user to partner:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 