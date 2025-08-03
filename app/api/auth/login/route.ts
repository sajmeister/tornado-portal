import { NextRequest, NextResponse } from 'next/server';
import { fnAuthenticateUser, fnGenerateToken } from '../../../../src/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const objBody = await request.json();
    const { strEmail, strPassword } = objBody;

    // Validate input
    if (!strEmail || !strPassword) {
      return NextResponse.json({
        success: false,
        message: 'Email and password are required'
      }, { status: 400 });
    }

    // Authenticate user
    const objUser = await fnAuthenticateUser({ strEmail, strPassword });

    if (!objUser) {
      return NextResponse.json({
        success: false,
        message: 'Invalid email or password'
      }, { status: 401 });
    }

    // Generate JWT token
    const strToken = await fnGenerateToken(objUser);

    // Set HTTP-only cookie
    const objResponse = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        strUserId: objUser.strUserId,
        strUsername: objUser.strUsername,
        strEmail: objUser.strEmail,
        strName: objUser.strName,
        strRole: objUser.strRole,
        strAvatarUrl: objUser.strAvatarUrl,
      }
    });

    objResponse.cookies.set('auth-token', strToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
      domain: undefined, // Let the browser set the domain
    });

    return objResponse;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
} 