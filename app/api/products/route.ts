import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { tblProducts } from '@/src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { fnVerifyToken } from '@/src/lib/auth';
import { fnGetUserPartnerId, fnGetPartnerDiscountRate, fnCalculatePartnerPrice, fnCanBypassPartnerIsolation } from '@/src/lib/partners';

// Check if user has permission to manage products
function fnCanManageProducts(strRole: string): boolean {
  return strRole === 'super_admin' || strRole === 'provider_user';
}

// Check if user has permission to view products
function fnCanViewProducts(strRole: string): boolean {
  return ['super_admin', 'provider_user', 'partner_admin', 'partner_user'].includes(strRole);
}

// GET /api/products - List all products (with partner-specific pricing)
export async function GET(request: NextRequest) {
  try {
    // Get user info from middleware headers
    const strUserId = request.headers.get('x-user-id');
    const strUserRole = request.headers.get('x-user-role');
    
    if (!strUserId || !strUserRole) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // Check if user has permission to view products
    if (!fnCanViewProducts(strUserRole)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Access denied. You do not have permission to view products.' 
      }, { status: 403 });
    }

    // Fetch all products
    const arrProducts = await db
      .select({
        strProductId: tblProducts.strProductId,
        strProductName: tblProducts.strProductName,
        strProductCode: tblProducts.strProductCode,
        strDescription: tblProducts.strDescription,
        decBasePrice: tblProducts.decBasePrice,
        decPartnerPrice: tblProducts.decPartnerPrice,
        strCategory: tblProducts.strCategory,
        intStockQuantity: tblProducts.intStockQuantity,
        bIsActive: tblProducts.bIsActive,
        dtCreated: tblProducts.dtCreated,
      })
      .from(tblProducts)
      .where(eq(tblProducts.bIsActive, true))
      .orderBy(tblProducts.strProductName);

    // Apply partner-specific pricing if user is a partner
    let arrProductsWithPricing = arrProducts;
    if (!fnCanBypassPartnerIsolation(strUserRole)) {
      const strPartnerId = await fnGetUserPartnerId(strUserId);
      if (strPartnerId) {
        const decDiscountRate = await fnGetPartnerDiscountRate(strPartnerId);
        arrProductsWithPricing = arrProducts.map(objProduct => ({
          ...objProduct,
          decPartnerPrice: fnCalculatePartnerPrice(objProduct.decBasePrice, decDiscountRate),
          decDiscountRate
        }));
      }
    }

    return NextResponse.json({
      success: true,
      products: arrProductsWithPricing,
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}

// POST /api/products - Create a new product
export async function POST(request: NextRequest) {
  try {
    // Get user info from middleware headers
    const strUserRole = request.headers.get('x-user-role');
    
    if (!strUserRole) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // Check if user has permission to create products
    if (!fnCanManageProducts(strUserRole)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Access denied. Only Super Admin and Provider User roles can manage products.' 
      }, { status: 403 });
    }

    const objBody = await request.json();
    const { strName, strDescription, decPrice, strCategory, bIsActive } = objBody;

    // Validate required fields
    if (!strName || !strDescription || decPrice === undefined || !strCategory) {
      return NextResponse.json({
        success: false,
        message: 'Product name, description, price, and category are required'
      }, { status: 400 });
    }

    // Validate price
    if (decPrice < 0) {
      return NextResponse.json({
        success: false,
        message: 'Price must be non-negative'
      }, { status: 400 });
    }

    // Generate product ID
    const strProductId = `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create product
    const arrNewProducts = await db
      .insert(tblProducts)
      .values({
        strProductId,
        strProductName: strName,
        strProductCode: `PROD_${Date.now()}`,
        strDescription,
        decBasePrice: decPrice,
        decPartnerPrice: decPrice * 0.9, // 10% discount for partners
        strCategory,
        bIsActive: bIsActive !== undefined ? bIsActive : true,
        dtCreated: new Date(),
      })
      .returning({
        strProductId: tblProducts.strProductId,
        strName: tblProducts.strProductName,
        strDescription: tblProducts.strDescription,
        decPrice: tblProducts.decBasePrice,
        strCategory: tblProducts.strCategory,
        bIsActive: tblProducts.bIsActive,
        dtCreated: tblProducts.dtCreated,
      });

    if (arrNewProducts.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Failed to create product'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Product created successfully',
      product: arrNewProducts[0],
    });

  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
} 