import { db } from './db';
import { tblPartnerUsers, tblPartners, tblPartnerPrices } from './db/schema';
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

// Get partner-specific price for a product
export async function fnGetPartnerPrice(strPartnerId: string, strProductId: string): Promise<number | null> {
  try {
    const arrPartnerPrices = await db
      .select({
        decPartnerPrice: tblPartnerPrices.decPartnerPrice,
      })
      .from(tblPartnerPrices)
      .where(and(
        eq(tblPartnerPrices.strPartnerId, strPartnerId),
        eq(tblPartnerPrices.strProductId, strProductId),
        eq(tblPartnerPrices.bIsActive, true)
      ))
      .limit(1);

    return arrPartnerPrices.length > 0 ? arrPartnerPrices[0].decPartnerPrice : null;
  } catch (error) {
    console.error('Error getting partner price:', error);
    return null;
  }
}

// Get all partner prices for a partner
export async function fnGetPartnerPrices(strPartnerId: string): Promise<Array<{ strProductId: string; decPartnerPrice: number }>> {
  try {
    const arrPartnerPrices = await db
      .select({
        strProductId: tblPartnerPrices.strProductId,
        decPartnerPrice: tblPartnerPrices.decPartnerPrice,
      })
      .from(tblPartnerPrices)
      .where(and(
        eq(tblPartnerPrices.strPartnerId, strPartnerId),
        eq(tblPartnerPrices.bIsActive, true)
      ));

    return arrPartnerPrices;
  } catch (error) {
    console.error('Error getting partner prices:', error);
    return [];
  }
}

// Set partner price for a product
export async function fnSetPartnerPrice(
  strPartnerId: string, 
  strProductId: string, 
  decPartnerPrice: number
): Promise<boolean> {
  try {
    // Check if partner price already exists
    const arrExistingPrices = await db
      .select()
      .from(tblPartnerPrices)
      .where(and(
        eq(tblPartnerPrices.strPartnerId, strPartnerId),
        eq(tblPartnerPrices.strProductId, strProductId),
        eq(tblPartnerPrices.bIsActive, true)
      ))
      .limit(1);

    if (arrExistingPrices.length > 0) {
      // Update existing price
      await db
        .update(tblPartnerPrices)
        .set({
          decPartnerPrice,
          dtUpdated: new Date(),
        })
        .where(and(
          eq(tblPartnerPrices.strPartnerId, strPartnerId),
          eq(tblPartnerPrices.strProductId, strProductId),
          eq(tblPartnerPrices.bIsActive, true)
        ));
    } else {
      // Create new price
      const strPartnerPriceId = `partner_price_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db
        .insert(tblPartnerPrices)
        .values({
          strPartnerPriceId,
          strPartnerId,
          strProductId,
          decPartnerPrice,
          dtCreated: new Date(),
          dtUpdated: new Date(),
          bIsActive: true,
        });
    }

    return true;
  } catch (error) {
    console.error('Error setting partner price:', error);
    return false;
  }
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