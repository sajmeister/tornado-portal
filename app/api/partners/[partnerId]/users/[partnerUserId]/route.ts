import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { tblPartnerUsers } from '@/src/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { EUserRole } from '@/src/lib/roles';

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