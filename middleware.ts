import { NextRequest, NextResponse } from 'next/server';
import { fnVerifyToken } from './src/lib/auth';

export async function middleware(request: NextRequest) {
  const strPath = request.nextUrl.pathname;
  
  // Public routes that don't require authentication
  const arrPublicRoutes = ['/login', '/register', '/api/auth/login'];
  
  if (arrPublicRoutes.includes(strPath)) {
    return NextResponse.next();
  }

  // Check for auth token in cookies
  const strToken = request.cookies.get('auth-token')?.value;
  
  console.log('🔍 Middleware Debug:');
  console.log('  Path:', strPath);
  console.log('  Token exists:', !!strToken);
  console.log('  All cookies:', request.cookies.getAll().map(c => c.name));

  if (!strToken) {
    // Redirect to login if no token
    if (strPath.startsWith('/api/')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    console.log('  Redirecting to login - no token found');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verify token
  const objDecoded = await fnVerifyToken(strToken);
  console.log('  Token verification result:', !!objDecoded);
  if (objDecoded) {
    console.log('  Decoded token user ID:', objDecoded.strUserId);
    console.log('  Decoded token role:', objDecoded.strRole);
  }
  
  if (!objDecoded) {
    console.log('  Token verification failed - redirecting to login');
    // Clear invalid token and redirect to login
    const objResponse = strPath.startsWith('/api/') 
      ? NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url));
    
    objResponse.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
    
    return objResponse;
  }

  // Add user info to headers for API routes
  if (strPath.startsWith('/api/')) {
    const objRequestHeaders = new Headers(request.headers);
    objRequestHeaders.set('x-user-id', objDecoded.strUserId);
    objRequestHeaders.set('x-user-role', objDecoded.strRole);
    
    return NextResponse.next({
      request: {
        headers: objRequestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}; 