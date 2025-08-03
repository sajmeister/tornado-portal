import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { tblUsers, tblPartnerUsers, tblQuotes, tblOrders } from '@/src/lib/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { EUserRole } from '@/src/lib/roles';

// DELETE /api/users/[userId] - Delete a user account completely
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: strUserId } = await params;
  
  try {
    // Get user info from middleware headers
    const strCurrentUserId = request.headers.get('x-user-id');
    const strUserRole = request.headers.get('x-user-role');
    
    if (!strCurrentUserId || !strUserRole) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    
    const strUserRoleNonNull = strUserRole as string;

    // Only Super Admins can delete users
    if (strUserRoleNonNull !== EUserRole.SUPER_ADMIN) {
      return NextResponse.json({ 
        success: false, 
        error: 'Insufficient permissions. Only Super Admins can delete users.' 
      }, { status: 403 });
    }

    // Prevent self-deletion
    if (strCurrentUserId === strUserId) {
      return NextResponse.json({ 
        success: false, 
        error: 'You cannot delete your own account.' 
      }, { status: 400 });
    }

    // Check if user exists
    const arrUser = await db
      .select()
      .from(tblUsers)
      .where(eq(tblUsers.strUserId, strUserId))
      .limit(1);

    if (arrUser.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    const objUser = arrUser[0];

    // Check if user is currently associated with any active partner
    const arrActivePartnerAssociations = await db
      .select()
      .from(tblPartnerUsers)
      .where(and(
        eq(tblPartnerUsers.strUserId, strUserId),
        eq(tblPartnerUsers.bIsActive, true)
      ));

    if (arrActivePartnerAssociations.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Cannot delete user who is currently associated with a partner organization. Please remove them from all partners first.' 
      }, { status: 400 });
    }

    // Check if user has any quotes
    const arrUserQuotes = await db
      .select()
      .from(tblQuotes)
      .where(eq(tblQuotes.strCreatedBy, strUserId))
      .limit(1);

    if (arrUserQuotes.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Cannot delete user who has created quotes. Please handle their quotes first.' 
      }, { status: 400 });
    }

    // Check if user has any orders
    const arrUserOrders = await db
      .select()
      .from(tblOrders)
      .where(eq(tblOrders.strCreatedBy, strUserId))
      .limit(1);

    if (arrUserOrders.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Cannot delete user who has orders. Please handle their orders first.' 
      }, { status: 400 });
    }

    // Check if this is the last Super Admin trying to be deleted
    if (objUser.strRole === 'super_admin') {
      // Count how many other Super Admins exist (excluding the current user)
      const arrOtherSuperAdmins = await db
        .select()
        .from(tblUsers)
        .where(and(
          eq(tblUsers.strRole, 'super_admin'),
          eq(tblUsers.bIsActive, true),
          ne(tblUsers.strUserId, strUserId)
        ));

      if (arrOtherSuperAdmins.length === 0) {
        return NextResponse.json({ 
          success: false, 
          error: 'Cannot delete the last Super Admin. At least one Super Admin must remain in the system.' 
        }, { status: 400 });
      }
    }

    // Soft delete all partner associations (set bIsActive to false)
    await db
      .update(tblPartnerUsers)
      .set({
        bIsActive: false,
        dtUpdated: new Date(),
      })
      .where(eq(tblPartnerUsers.strUserId, strUserId));

    // Soft delete the user account (set bIsActive to false)
    await db
      .update(tblUsers)
      .set({
        bIsActive: false,
        dtUpdated: new Date(),
      })
      .where(eq(tblUsers.strUserId, strUserId));

    return NextResponse.json({ 
      success: true, 
      message: `User ${objUser.strName} has been deleted successfully.` 
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// PUT /api/users/[userId] - Update user role
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: strUserId } = await params;
  
  try {
    // Get user info from middleware headers
    const strCurrentUserId = request.headers.get('x-user-id');
    const strUserRole = request.headers.get('x-user-role');
    
    if (!strCurrentUserId || !strUserRole) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    
    const strUserRoleNonNull = strUserRole as string;

    // Only Super Admins can update user roles
    if (strUserRoleNonNull !== EUserRole.SUPER_ADMIN) {
      return NextResponse.json({ 
        success: false, 
        error: 'Insufficient permissions. Only Super Admins can update user roles.' 
      }, { status: 403 });
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
    const arrValidRoles = ['super_admin', 'provider_user', 'partner_admin', 'partner_user'];
    if (!arrValidRoles.includes(strRole)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid role' 
      }, { status: 400 });
    }

    // Check if user exists
    const arrUser = await db
      .select()
      .from(tblUsers)
      .where(eq(tblUsers.strUserId, strUserId))
      .limit(1);

    if (arrUser.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    const objUser = arrUser[0];

    // Check if this is the last Super Admin trying to change their role
    if (objUser.strRole === 'super_admin' && strRole !== 'super_admin') {
      // Count how many other Super Admins exist (excluding the current user)
      const arrOtherSuperAdmins = await db
        .select()
        .from(tblUsers)
        .where(and(
          eq(tblUsers.strRole, 'super_admin'),
          eq(tblUsers.bIsActive, true),
          ne(tblUsers.strUserId, strUserId)
        ));

      if (arrOtherSuperAdmins.length === 0) {
        return NextResponse.json({ 
          success: false, 
          error: 'Cannot change role from Super Admin. This would leave the system without any Super Admins. At least one Super Admin must remain.' 
        }, { status: 400 });
      }
    }

    // Update user role
    const dtNow = new Date();

    const arrUpdatedUser = await db
      .update(tblUsers)
      .set({
        strRole,
        dtUpdated: dtNow,
      })
      .where(eq(tblUsers.strUserId, strUserId))
      .returning({
        strUserId: tblUsers.strUserId,
        strUsername: tblUsers.strUsername,
        strEmail: tblUsers.strEmail,
        strName: tblUsers.strName,
        strRole: tblUsers.strRole,
        bIsActive: tblUsers.bIsActive,
      });

    return NextResponse.json({ 
      success: true, 
      user: arrUpdatedUser[0],
      message: 'User role updated successfully' 
    });

  } catch (error) {
    console.error('Error updating user role:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}