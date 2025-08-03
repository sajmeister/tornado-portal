import { NextResponse } from 'next/server';

export async function POST() {
  const objResponse = NextResponse.json({
    success: true,
    message: 'Logout successful'
  });

  // Clear the auth cookie
  objResponse.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return objResponse;
} 