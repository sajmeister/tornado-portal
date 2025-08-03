import { db } from './db';
import { tblPartnerUsers, tblPartners } from './db/schema';
import { eq, and } from 'drizzle-orm';
import { EUserRole } from './roles';

export interface IPartner {
  strPartnerId: string;
  strPartnerName: string;
  strPartnerCode: string;
  strContactEmail: string;
  strContactPhone: string | null;
  strAddress: string | null;
  strCity: string | null;
  strState: string | null;
  strCountry: string | null;
  strPostalCode: string | null;
  decDiscountRate: number | null;
  dtCreated: Date | null;
  dtUpdated: Date | null;
  bIsActive: boolean | null;
}

// Get user's partner ID (for partner isolation)
export async function fnGetUserPartnerId(strUserId: string): Promise<string | null> {
  try {
    const arrPartnerUsers = await db
      .select({
        strPartnerId: tblPartnerUsers.strPartnerId,
      })
      .from(tblPartnerUsers)
      .where(and(
        eq(tblPartnerUsers.strUserId, strUserId),
        eq(tblPartnerUsers.bIsActive, true)
      ))
      .limit(1);

    return arrPartnerUsers.length > 0 ? arrPartnerUsers[0].strPartnerId : null;
  } catch (error) {
    console.error('Error getting user partner ID:', error);
    return null;
  }
}

// Get user's partner details
export async function fnGetUserPartner(strUserId: string): Promise<IPartner | null> {
  try {
    const strPartnerId = await fnGetUserPartnerId(strUserId);
    if (!strPartnerId) return null;

    const arrPartners = await db
      .select()
      .from(tblPartners)
      .where(and(
        eq(tblPartners.strPartnerId, strPartnerId),
        eq(tblPartners.bIsActive, true)
      ))
      .limit(1);

    return arrPartners.length > 0 ? arrPartners[0] : null;
  } catch (error) {
    console.error('Error getting user partner:', error);
    return null;
  }
}

// Check if user can access partner data (for isolation)
export async function fnCanAccessPartner(strUserId: string, strPartnerId: string): Promise<boolean> {
  try {
    const arrPartnerUsers = await db
      .select()
      .from(tblPartnerUsers)
      .where(and(
        eq(tblPartnerUsers.strUserId, strUserId),
        eq(tblPartnerUsers.strPartnerId, strPartnerId),
        eq(tblPartnerUsers.bIsActive, true)
      ))
      .limit(1);

    return arrPartnerUsers.length > 0;
  } catch (error) {
    console.error('Error checking partner access:', error);
    return false;
  }
}

// Get partner-specific discount rate
export async function fnGetPartnerDiscountRate(strPartnerId: string): Promise<number> {
  try {
    const arrPartners = await db
      .select({
        decDiscountRate: tblPartners.decDiscountRate,
      })
      .from(tblPartners)
      .where(and(
        eq(tblPartners.strPartnerId, strPartnerId),
        eq(tblPartners.bIsActive, true)
      ))
      .limit(1);

    return arrPartners.length > 0 ? (arrPartners[0].decDiscountRate || 0) : 0;
  } catch (error) {
    console.error('Error getting partner discount rate:', error);
    return 0;
  }
}

// Calculate partner-specific price
export function fnCalculatePartnerPrice(decBasePrice: number, decDiscountRate: number): number {
  const decDiscountAmount = decBasePrice * (decDiscountRate / 100);
  return decBasePrice - decDiscountAmount;
}

// Check if user role can bypass partner isolation
export function fnCanBypassPartnerIsolation(strUserRole: string): boolean {
  return strUserRole === EUserRole.SUPER_ADMIN || strUserRole === EUserRole.PROVIDER_USER;
}

// Get all partners (for admin users)
export async function fnGetAllPartners(): Promise<IPartner[]> {
  try {
    const arrPartners = await db
      .select()
      .from(tblPartners)
      .where(eq(tblPartners.bIsActive, true))
      .orderBy(tblPartners.strPartnerName);

    return arrPartners;
  } catch (error) {
    console.error('Error getting all partners:', error);
    return [];
  }
}

// Associate user with partner
export async function fnAssociateUserWithPartner(
  strUserId: string, 
  strPartnerId: string, 
  strRole: string
): Promise<boolean> {
  try {
    const strPartnerUserId = `partner_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const dtNow = new Date();

    await db
      .insert(tblPartnerUsers)
      .values({
        strPartnerUserId,
        strUserId,
        strPartnerId,
        strRole,
        dtCreated: dtNow,
        dtUpdated: dtNow,
        bIsActive: true,
      });

    return true;
  } catch (error) {
    console.error('Error associating user with partner:', error);
    return false;
  }
} 