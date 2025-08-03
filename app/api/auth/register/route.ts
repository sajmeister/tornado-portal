import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { tblUsers } from '@/src/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// POST /api/auth/register - Register a new user
export async function POST(request: NextRequest) {
  try {
    // Get user info from middleware headers
    const strUserRole = request.headers.get('x-user-role');
    
    if (!strUserRole) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    
    const strUserRoleNonNull = strUserRole as string;

    // Only super_admin and partner_admin can create users
    if (!['super_admin', 'partner_admin'].includes(strUserRoleNonNull)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Insufficient permissions. Only administrators can create users.' 
      }, { status: 403 });
    }

    const objBody = await request.json();
    const { strUsername, strEmail, strName, strPassword, strRole } = objBody;

    // Validate required fields
    if (!strUsername || !strEmail || !strName || !strPassword || !strRole) {
      return NextResponse.json({ 
        success: false, 
        error: 'All fields are required' 
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

    // Check if username already exists
    const arrExistingUsername = await db
      .select()
      .from(tblUsers)
      .where(eq(tblUsers.strUsername, strUsername))
      .limit(1);

    if (arrExistingUsername.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Username already exists' 
      }, { status: 409 });
    }

    // Check if email already exists
    const arrExistingEmail = await db
      .select()
      .from(tblUsers)
      .where(eq(tblUsers.strEmail, strEmail))
      .limit(1);

    if (arrExistingEmail.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Email already exists' 
      }, { status: 409 });
    }

    // Hash password
    const strHashedPassword = await bcrypt.hash(strPassword, 10);

    // Generate user ID
    const strUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const dtNow = new Date();

    // Create user
    const arrNewUser = await db
      .insert(tblUsers)
      .values({
        strUserId,
        strUsername,
        strEmail,
        strName,
        strPasswordHash: strHashedPassword,
        strRole,
        strProvider: 'local',
        strProviderId: strUserId,
        dtCreated: dtNow,
        dtUpdated: dtNow,
        bIsActive: true,
      })
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
      user: arrNewUser[0],
      message: 'User created successfully' 
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 