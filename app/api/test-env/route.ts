import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Environment variables test',
    tursoUrl: process.env.TURSO_DATABASE_URL ? 'Set' : 'Not set',
    tursoToken: process.env.TURSO_AUTH_TOKEN ? 'Set' : 'Not set',
    nextAuthUrl: process.env.NEXTAUTH_URL ? 'Set' : 'Not set',
    githubClientId: process.env.GITHUB_CLIENT_ID ? 'Set' : 'Not set',
    timestamp: new Date().toISOString()
  });
} 