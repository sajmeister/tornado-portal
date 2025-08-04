import { NextRequest, NextResponse } from 'next/server';
import { fnGetUserById } from '../../../../src/lib/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const strUserId = request.headers.get('x-user-id');
    
    if (!strUserId) {
      return NextResponse.json({
        success: false,
        message: 'User not authenticated'
      }, { status: 401 });
    }

    const objUser = await fnGetUserById(strUserId);

    if (!objUser) {
      return NextResponse.json({
        success: false,
        message: 'User not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        strUserId: objUser.strUserId,
        strUsername: objUser.strUsername,
        strEmail: objUser.strEmail,
        strName: objUser.strName,
        strRole: objUser.strRole,
        strAvatarUrl: objUser.strAvatarUrl,
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
} 