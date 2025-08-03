import bcrypt from 'bcryptjs';
import * as jose from 'jose';
import { db } from './db';
import { tblUsers } from './db/schema';
import { eq } from 'drizzle-orm';
import { EUserRole, fnGetRoleDisplayName } from './roles';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface IUser {
  strUserId: string;
  strUsername: string;
  strEmail: string;
  strName: string;
  strRole: string;
  strAvatarUrl?: string;
  bIsActive: boolean;
}

export interface ILoginCredentials {
  strEmail: string;
  strPassword: string;
}

export interface IRegisterData {
  strUsername: string;
  strEmail: string;
  strName: string;
  strPassword: string;
  strRole?: string;
}

// Password utilities
export async function fnHashPassword(strPassword: string): Promise<string> {
  const intSaltRounds = 12;
  return await bcrypt.hash(strPassword, intSaltRounds);
}

export async function fnVerifyPassword(strPassword: string, strHash: string): Promise<boolean> {
  return await bcrypt.compare(strPassword, strHash);
}

// JWT utilities
export async function fnGenerateToken(objUser: IUser): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  const token = await new jose.SignJWT({
    strUserId: objUser.strUserId,
    strUsername: objUser.strUsername,
    strEmail: objUser.strEmail,
    strRole: objUser.strRole,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret);
  
  return token;
}

export async function fnVerifyToken(strToken: string): Promise<any> {
  try {
    console.log('🔐 JWT Verification Debug:');
    console.log('  JWT Secret exists:', !!JWT_SECRET);
    console.log('  Token length:', strToken.length);
    console.log('  Token preview:', strToken.substring(0, 50) + '...');
    
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jose.jwtVerify(strToken, secret);
    
    console.log('  Token verification successful');
    console.log('  Decoded user ID:', payload.strUserId);
    return payload;
  } catch (error) {
    console.log('  Token verification failed:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Authentication functions
export async function fnAuthenticateUser(objCredentials: ILoginCredentials): Promise<IUser | null> {
  try {
    const arrUsers = await db
      .select({
        strUserId: tblUsers.strUserId,
        strUsername: tblUsers.strUsername,
        strEmail: tblUsers.strEmail,
        strName: tblUsers.strName,
        strPasswordHash: tblUsers.strPasswordHash,
        strRole: tblUsers.strRole,
        strAvatarUrl: tblUsers.strAvatarUrl,
        bIsActive: tblUsers.bIsActive,
      })
      .from(tblUsers)
      .where(eq(tblUsers.strEmail, objCredentials.strEmail))
      .limit(1);

    if (arrUsers.length === 0) {
      return null;
    }

    const objUser = arrUsers[0];

    if (!objUser.strPasswordHash || !objUser.bIsActive) {
      return null;
    }

    const bIsPasswordValid = await fnVerifyPassword(objCredentials.strPassword, objUser.strPasswordHash);
    
    if (!bIsPasswordValid) {
      return null;
    }

    // Update last login
    await db
      .update(tblUsers)
      .set({ dtLastLogin: new Date() })
      .where(eq(tblUsers.strUserId, objUser.strUserId));

    return {
      strUserId: objUser.strUserId,
      strUsername: objUser.strUsername || '',
      strEmail: objUser.strEmail,
      strName: objUser.strName,
      strRole: objUser.strRole || '',
      strAvatarUrl: objUser.strAvatarUrl || undefined,
      bIsActive: objUser.bIsActive || false,
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

export async function fnCreateUser(objUserData: IRegisterData): Promise<IUser | null> {
  try {
    const strUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const strPasswordHash = await fnHashPassword(objUserData.strPassword);

    const arrNewUsers = await db
      .insert(tblUsers)
      .values({
        strUserId,
        strUsername: objUserData.strUsername,
        strEmail: objUserData.strEmail,
        strName: objUserData.strName,
        strPasswordHash,
        strRole: objUserData.strRole || 'user',
        bIsActive: true,
        strProvider: 'local',
        strProviderId: strUserId,
      })
      .returning({
        strUserId: tblUsers.strUserId,
        strUsername: tblUsers.strUsername,
        strEmail: tblUsers.strEmail,
        strName: tblUsers.strName,
        strRole: tblUsers.strRole,
        strAvatarUrl: tblUsers.strAvatarUrl,
        bIsActive: tblUsers.bIsActive,
      });

    if (arrNewUsers.length === 0) {
      return null;
    }

    const objNewUser = arrNewUsers[0];
    return {
      strUserId: objNewUser.strUserId,
      strUsername: objNewUser.strUsername || '',
      strEmail: objNewUser.strEmail,
      strName: objNewUser.strName,
      strRole: objNewUser.strRole || '',
      strAvatarUrl: objNewUser.strAvatarUrl || undefined,
      bIsActive: objNewUser.bIsActive || false,
    };
  } catch (error) {
    console.error('User creation error:', error);
    return null;
  }
}

export async function fnGetUserById(strUserId: string): Promise<IUser | null> {
  try {
    const arrUsers = await db
      .select({
        strUserId: tblUsers.strUserId,
        strUsername: tblUsers.strUsername,
        strEmail: tblUsers.strEmail,
        strName: tblUsers.strName,
        strRole: tblUsers.strRole,
        strAvatarUrl: tblUsers.strAvatarUrl,
        bIsActive: tblUsers.bIsActive,
      })
      .from(tblUsers)
      .where(eq(tblUsers.strUserId, strUserId))
      .limit(1);

    if (arrUsers.length === 0) {
      return null;
    }

    const objUser = arrUsers[0];
    return {
      strUserId: objUser.strUserId,
      strUsername: objUser.strUsername || '',
      strEmail: objUser.strEmail,
      strName: objUser.strName,
      strRole: objUser.strRole || '',
      strAvatarUrl: objUser.strAvatarUrl || undefined,
      bIsActive: objUser.bIsActive || false,
    };
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
} 