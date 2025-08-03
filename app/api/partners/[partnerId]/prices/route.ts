import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { tblPartnerPrices, tblProducts, tblPartners } from '@/src/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { fnHasPermission } from '@/src/lib/roles';

// GET /api/partners/[partnerId]/prices - Get all partner prices for a partner
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  try {
    const { partnerId } = await params;
    
    // Get user info from middleware headers
    const strUserRole = request.headers.get('x-user-role');
    
    if (!strUserRole) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // Check if user has permission to manage partner prices
    if (!fnHasPermission(strUserRole, 'partner:manage')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Access denied. You do not have permission to manage partner prices.' 
      }, { status: 403 });
    }

    // Verify partner exists
    const arrPartners = await db
      .select()
      .from(tblPartners)
      .where(and(
        eq(tblPartners.strPartnerId, partnerId),
        eq(tblPartners.bIsActive, true)
      ))
      .limit(1);

    if (arrPartners.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Partner not found' 
      }, { status: 404 });
    }

    // Get all products with their partner prices
    const arrProducts = await db
      .select({
        strProductId: tblProducts.strProductId,
        strProductName: tblProducts.strProductName,
        strProductCode: tblProducts.strProductCode,
        decBasePrice: tblProducts.decBasePrice,
        strCategory: tblProducts.strCategory,
      })
      .from(tblProducts)
      .where(eq(tblProducts.bIsActive, true))
      .orderBy(tblProducts.strProductName);

    // Get partner prices for this partner
    const arrPartnerPrices = await db
      .select({
        strProductId: tblPartnerPrices.strProductId,
        decPartnerPrice: tblPartnerPrices.decPartnerPrice,
      })
      .from(tblPartnerPrices)
      .where(and(
        eq(tblPartnerPrices.strPartnerId, partnerId),
        eq(tblPartnerPrices.bIsActive, true)
      ));

    // Create a map of product prices
    const objPriceMap = new Map();
    arrPartnerPrices.forEach(price => {
      objPriceMap.set(price.strProductId, price.decPartnerPrice);
    });

    // Combine products with their partner prices
    const arrProductsWithPrices = arrProducts.map(product => ({
      ...product,
      decPartnerPrice: objPriceMap.get(product.strProductId) || product.decBasePrice,
      bHasCustomPrice: objPriceMap.has(product.strProductId),
    }));

    return NextResponse.json({
      success: true,
      partner: arrPartners[0],
      products: arrProductsWithPrices,
    });

  } catch (error) {
    console.error('Error fetching partner prices:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}

// POST /api/partners/[partnerId]/prices - Set partner prices
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  try {
    const { partnerId } = await params;
    
    // Get user info from middleware headers
    const strUserRole = request.headers.get('x-user-role');
    
    if (!strUserRole) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // Check if user has permission to manage partner prices
    if (!fnHasPermission(strUserRole, 'partner:manage')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Access denied. You do not have permission to manage partner prices.' 
      }, { status: 403 });
    }

    // Verify partner exists
    const arrPartners = await db
      .select()
      .from(tblPartners)
      .where(and(
        eq(tblPartners.strPartnerId, partnerId),
        eq(tblPartners.bIsActive, true)
      ))
      .limit(1);

    if (arrPartners.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Partner not found' 
      }, { status: 404 });
    }

    const objBody = await request.json();
    const { arrPrices } = objBody; // Array of { strProductId, decPartnerPrice }

    if (!Array.isArray(arrPrices)) {
      return NextResponse.json({
        success: false,
        message: 'Prices array is required'
      }, { status: 400 });
    }

    // Validate and set prices
    const arrResults = [];
    for (const priceData of arrPrices) {
      const { strProductId, decPartnerPrice } = priceData;

      if (!strProductId || decPartnerPrice === undefined) {
        arrResults.push({
          strProductId,
          success: false,
          message: 'Product ID and price are required'
        });
        continue;
      }

      if (decPartnerPrice < 0) {
        arrResults.push({
          strProductId,
          success: false,
          message: 'Price must be non-negative'
        });
        continue;
      }

      try {
        // Verify product exists
        const arrProducts = await db
          .select()
          .from(tblProducts)
          .where(and(
            eq(tblProducts.strProductId, strProductId),
            eq(tblProducts.bIsActive, true)
          ))
          .limit(1);

        if (arrProducts.length === 0) {
          arrResults.push({
            strProductId,
            success: false,
            message: 'Product not found'
          });
          continue;
        }

        // Check if partner price already exists
        const arrExistingPrices = await db
          .select()
          .from(tblPartnerPrices)
          .where(and(
            eq(tblPartnerPrices.strPartnerId, partnerId),
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
              eq(tblPartnerPrices.strPartnerId, partnerId),
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
              strPartnerId: partnerId,
              strProductId,
              decPartnerPrice,
              dtCreated: new Date(),
              dtUpdated: new Date(),
              bIsActive: true,
            });
        }

        arrResults.push({
          strProductId,
          success: true,
          message: 'Price updated successfully'
        });

      } catch (error) {
        console.error(`Error setting price for product ${strProductId}:`, error);
        arrResults.push({
          strProductId,
          success: false,
          message: 'Internal server error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Partner prices updated',
      results: arrResults,
    });

  } catch (error) {
    console.error('Error setting partner prices:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
} 