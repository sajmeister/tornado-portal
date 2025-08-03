import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { tblPartners, tblPartnerUsers } from '@/src/lib/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { EUserRole } from '@/src/lib/roles';

// GET /api/partners/[partnerId] - Get specific partner
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
    
    // Super admin and provider users can see any partner
    if (strUserRoleNonNull === EUserRole.SUPER_ADMIN || strUserRoleNonNull === EUserRole.PROVIDER_USER) {
      const arrPartners = await db
        .select()
        .from(tblPartners)
        .where(and(
          eq(tblPartners.strPartnerId, strPartnerId),
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
        partner: arrPartners[0] 
      });
    }

    // Partner users can only see their own partner
    if (strUserRoleNonNull === EUserRole.PARTNER_ADMIN || strUserRoleNonNull === EUserRole.PARTNER_USER) {
      // Check if user belongs to this partner
      const arrPartnerUsers = await db
        .select({
          strPartnerId: tblPartnerUsers.strPartnerId,
        })
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

      const arrPartners = await db
        .select()
        .from(tblPartners)
        .where(and(
          eq(tblPartners.strPartnerId, strPartnerId),
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
        partner: arrPartners[0] 
      });
    }

    return NextResponse.json({ 
      success: false, 
      error: 'Insufficient permissions' 
    }, { status: 403 });

  } catch (error) {
    console.error('Error fetching partner:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// PUT /api/partners/[partnerId] - Update partner (Super Admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { partnerId: strPartnerId } = await params;
  try {
    
    // Get user info from middleware headers
    const strUserRole = request.headers.get('x-user-role');
    
    if (!strUserRole) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    
    const strUserRoleNonNull = strUserRole as string;

    // Only super admin can update partners
    if (strUserRoleNonNull !== EUserRole.SUPER_ADMIN) {
      return NextResponse.json({ 
        success: false, 
        error: 'Insufficient permissions' 
      }, { status: 403 });
    }

    const objBody = await request.json();
    const {
      strPartnerName,
      strPartnerCode,
      strContactEmail,
      strContactPhone,
      strAddress,
      strCity,
      strState,
      strCountry,
      strPostalCode
    } = objBody;

    // Validate required fields
    if (!strPartnerName || !strPartnerCode || !strContactEmail) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    // Check if partner exists
    const arrExistingPartner = await db
      .select()
      .from(tblPartners)
      .where(eq(tblPartners.strPartnerId, strPartnerId))
      .limit(1);

    if (arrExistingPartner.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Partner not found' 
      }, { status: 404 });
    }

    // Check if partner code already exists (excluding current partner)
    const arrExistingPartners = await db
      .select()
      .from(tblPartners)
      .where(and(
        eq(tblPartners.strPartnerCode, strPartnerCode),
        ne(tblPartners.strPartnerId, strPartnerId)
      ))
      .limit(1);

    if (arrExistingPartners.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Partner code already exists' 
      }, { status: 409 });
    }

    // Update partner
    const dtNow = new Date();

    const arrUpdatedPartner = await db
      .update(tblPartners)
      .set({
        strPartnerName,
        strPartnerCode,
        strContactEmail,
        strContactPhone,
        strAddress,
        strCity,
        strState,
        strCountry,
        strPostalCode,

        dtUpdated: dtNow,
      })
      .where(eq(tblPartners.strPartnerId, strPartnerId))
      .returning();

    return NextResponse.json({ 
      success: true, 
      partner: arrUpdatedPartner[0] 
    });

  } catch (error) {
    console.error('Error updating partner:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// DELETE /api/partners/[partnerId] - Delete partner (Super Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { partnerId: strPartnerId } = await params;
  try {
    
    // Get user info from middleware headers
    const strUserRole = request.headers.get('x-user-role');
    
    if (!strUserRole) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    
    const strUserRoleNonNull = strUserRole as string;

    // Only super admin can delete partners
    if (strUserRoleNonNull !== EUserRole.SUPER_ADMIN) {
      return NextResponse.json({ 
        success: false, 
        error: 'Insufficient permissions' 
      }, { status: 403 });
    }

    // Check if partner exists
    const arrExistingPartner = await db
      .select()
      .from(tblPartners)
      .where(eq(tblPartners.strPartnerId, strPartnerId))
      .limit(1);

    if (arrExistingPartner.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Partner not found' 
      }, { status: 404 });
    }

    // Soft delete partner (set bIsActive to false)
    const dtNow = new Date();

    await db
      .update(tblPartners)
      .set({
        bIsActive: false,
        dtUpdated: dtNow,
      })
      .where(eq(tblPartners.strPartnerId, strPartnerId));

    return NextResponse.json({ 
      success: true, 
      message: 'Partner deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting partner:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 