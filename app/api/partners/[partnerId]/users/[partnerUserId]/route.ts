import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { tblPartnerUsers } from '@/src/lib/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { EUserRole } from '@/src/lib/roles';

// PUT /api/partners/[partnerId]/users/[partnerUserId] - Update partner user role
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string; partnerUserId: string }> }
) {
  const { partnerId: strPartnerId, partnerUserId: strPartnerUserId } = await params;
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
          error: 'Access denied' 
        }, { status: 403 });
      }
    }

    const objBody = await request.json();
    const { strRole } = objBody;

    // Validate required fields
    if (!strRole) {
      return NextResponse.json({ 
        success: false, 
        error: 'Role is required' 
      }, { status: 400 });
    }

    // Validate role
    if (!['partner_user', 'partner_admin'].includes(strRole)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid role' 
      }, { status: 400 });
    }

    // Check if partner user exists
    const arrPartnerUser = await db
      .select()
      .from(tblPartnerUsers)
      .where(and(
        eq(tblPartnerUsers.strPartnerUserId, strPartnerUserId),
        eq(tblPartnerUsers.strPartnerId, strPartnerId),
        eq(tblPartnerUsers.bIsActive, true)
      ))
      .limit(1);

    if (arrPartnerUser.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Partner user not found' 
      }, { status: 404 });
    }

    const objPartnerUser = arrPartnerUser[0];

    // Check if this is the last admin trying to change their role to user
    if (objPartnerUser.strRole === 'partner_admin' && strRole === 'partner_user') {
      // Count how many other admins exist for this partner (excluding the current user)
      const arrOtherAdmins = await db
        .select()
        .from(tblPartnerUsers)
        .where(and(
          eq(tblPartnerUsers.strPartnerId, strPartnerId),
          eq(tblPartnerUsers.strRole, 'partner_admin'),
          eq(tblPartnerUsers.bIsActive, true),
          ne(tblPartnerUsers.strUserId, objPartnerUser.strUserId)
        ));

      if (arrOtherAdmins.length === 0) {
        return NextResponse.json({ 
          success: false, 
          error: 'Cannot change role to Partner User. This would leave the organization without any administrators. At least one administrator must remain.' 
        }, { status: 400 });
      }
    }

    // Update partner user role
    const dtNow = new Date();

    const arrUpdatedPartnerUser = await db
      .update(tblPartnerUsers)
      .set({
        strRole,
        dtUpdated: dtNow,
      })
      .where(eq(tblPartnerUsers.strPartnerUserId, strPartnerUserId))
      .returning();

    return NextResponse.json({ 
      success: true, 
      partnerUser: arrUpdatedPartnerUser[0],
      message: 'User role updated successfully' 
    });

  } catch (error) {
    console.error('Error updating partner user role:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// DELETE /api/partners/[partnerId]/users/[partnerUserId] - Remove user from partner
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string; partnerUserId: string }> }
) {
  const { partnerId: strPartnerId, partnerUserId: strPartnerUserId } = await params;
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
          error: 'Access denied' 
        }, { status: 403 });
      }
    }

    // Check if partner user exists
    const arrPartnerUser = await db
      .select()
      .from(tblPartnerUsers)
      .where(and(
        eq(tblPartnerUsers.strPartnerUserId, strPartnerUserId),
        eq(tblPartnerUsers.strPartnerId, strPartnerId),
        eq(tblPartnerUsers.bIsActive, true)
      ))
      .limit(1);

    if (arrPartnerUser.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Partner user not found' 
      }, { status: 404 });
    }

    const objPartnerUser = arrPartnerUser[0];

    // Prevent self-removal
    if (objPartnerUser.strUserId === strUserIdNonNull) {
      return NextResponse.json({ 
        success: false, 
        error: 'You cannot remove yourself from the partner organization.' 
      }, { status: 400 });
    }

    // Soft delete partner user (set bIsActive to false)
    const dtNow = new Date();

    await db
      .update(tblPartnerUsers)
      .set({
        bIsActive: false,
        dtUpdated: dtNow,
      })
      .where(eq(tblPartnerUsers.strPartnerUserId, strPartnerUserId));

    return NextResponse.json({ 
      success: true, 
      message: 'User removed from partner successfully' 
    });

  } catch (error) {
    console.error('Error removing user from partner:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 