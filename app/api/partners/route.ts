import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { tblPartners, tblPartnerUsers, tblUsers } from '@/src/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { EUserRole } from '@/src/lib/roles';

// GET /api/partners - Get partners (with isolation based on user role)
export async function GET(request: NextRequest) {
  try {
    // Get user info from middleware headers
    const strUserId = request.headers.get('x-user-id');
    const strUserRole = request.headers.get('x-user-role');
    
    if (!strUserId || !strUserRole) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    
    // Type assertion since we've already checked for null
    const strUserIdNonNull = strUserId as string;
    const strUserRoleNonNull = strUserRole as string;
    
    // Super admin and provider users can see all partners
    if (strUserRoleNonNull === EUserRole.SUPER_ADMIN || strUserRoleNonNull === EUserRole.PROVIDER_USER) {
      const arrPartners = await db
        .select()
        .from(tblPartners)
        .where(eq(tblPartners.bIsActive, true))
        .orderBy(tblPartners.strPartnerName);

      return NextResponse.json({ 
        success: true, 
        partners: arrPartners 
      });
    }

    // Partner customers can only see their own partner
          if (strUserRoleNonNull === EUserRole.PARTNER_ADMIN || strUserRoleNonNull === EUserRole.PARTNER_CUSTOMER) {
      // Get user's partner through tblPartnerUsers
      const arrPartnerUsers = await db
        .select({
          strPartnerId: tblPartnerUsers.strPartnerId,
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
        }, { status: 403 });
      }

      const strPartnerId = arrPartnerUsers[0].strPartnerId;
      const arrPartners = await db
        .select()
        .from(tblPartners)
        .where(and(
          eq(tblPartners.strPartnerId, strPartnerId),
          eq(tblPartners.bIsActive, true)
        ));

      return NextResponse.json({ 
        success: true, 
        partners: arrPartners 
      });
    }

    return NextResponse.json({ 
      success: false, 
      error: 'Insufficient permissions' 
    }, { status: 403 });

  } catch (error) {
    console.error('Error fetching partners:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// POST /api/partners - Create new partner (Super Admin only)
export async function POST(request: NextRequest) {
  try {
    // Get user info from middleware headers
    const strUserRole = request.headers.get('x-user-role');
    
    if (!strUserRole) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    
    // Type assertion since we've already checked for null
    const strUserRoleNonNull = strUserRole as string;

    // Only super admin can create partners
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

    // Check if partner code already exists
    const arrExistingPartners = await db
      .select()
      .from(tblPartners)
      .where(eq(tblPartners.strPartnerCode, strPartnerCode))
      .limit(1);

    if (arrExistingPartners.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Partner code already exists' 
      }, { status: 409 });
    }

    // Create new partner
    const strPartnerId = `partner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const dtNow = new Date();

    const arrNewPartner = await db
      .insert(tblPartners)
      .values({
        strPartnerId,
        strPartnerName,
        strPartnerCode,
        strContactEmail,
        strContactPhone,
        strAddress,
        strCity,
        strState,
        strCountry,
        strPostalCode,

        dtCreated: dtNow,
        dtUpdated: dtNow,
        bIsActive: true,
      })
      .returning();

    return NextResponse.json({ 
      success: true, 
      partner: arrNewPartner[0] 
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating partner:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 