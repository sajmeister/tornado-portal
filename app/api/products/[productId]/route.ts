import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/lib/db';
import { tblProducts } from '../../../../src/lib/db/schema';
import { eq } from 'drizzle-orm';

// Check if user has permission to manage products
function fnCanManageProducts(strRole: string): boolean {
  return strRole === 'super_admin' || strRole === 'provider_user';
}

// PUT /api/products/[productId] - Update a product
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    // Get user role from headers (set by middleware)
    const strUserRole = request.headers.get('x-user-role');
    
    if (!strUserRole) {
      return NextResponse.json({ 
        success: false, 
        message: 'Unauthorized' 
      }, { status: 401 });
    }

    // Check if user has permission to update products
    if (!fnCanManageProducts(strUserRole)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Access denied. Only Super Admin and Provider User roles can manage products.' 
      }, { status: 403 });
    }

    const { productId: strProductId } = await params;
    const objBody = await request.json();
    const { strName, strDescription, decPrice, strCategory, bIsActive } = objBody;

    // Build update object with only provided fields
    const objUpdateData: any = {};
    
    if (strName !== undefined) objUpdateData.strProductName = strName;
    if (strDescription !== undefined) objUpdateData.strDescription = strDescription;
    if (decPrice !== undefined) {
      objUpdateData.decBasePrice = decPrice;
      objUpdateData.decPartnerPrice = decPrice * 0.9; // 10% discount for partners
    }
    if (strCategory !== undefined) objUpdateData.strCategory = strCategory;
    if (bIsActive !== undefined) objUpdateData.bIsActive = bIsActive;
    
    objUpdateData.dtUpdated = new Date();

    // Update product
    const arrUpdatedProducts = await db
      .update(tblProducts)
      .set(objUpdateData)
      .where(eq(tblProducts.strProductId, strProductId))
      .returning({
        strProductId: tblProducts.strProductId,
        strName: tblProducts.strProductName,
        strDescription: tblProducts.strDescription,
        decPrice: tblProducts.decBasePrice,
        strCategory: tblProducts.strCategory,
        bIsActive: tblProducts.bIsActive,
        dtCreated: tblProducts.dtCreated,
      });

    if (arrUpdatedProducts.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Product not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Product updated successfully',
      product: arrUpdatedProducts[0],
    });

  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}

// DELETE /api/products/[productId] - Delete a product
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    // Get user role from headers (set by middleware)
    const strUserRole = request.headers.get('x-user-role');
    
    if (!strUserRole) {
      return NextResponse.json({ 
        success: false, 
        message: 'Unauthorized' 
      }, { status: 401 });
    }

    // Check if user has permission to delete products
    if (!fnCanManageProducts(strUserRole)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Access denied. Only Super Admin and Provider User roles can manage products.' 
      }, { status: 403 });
    }

    const { productId: strProductId } = await params;

    // Check if product exists
    const arrExistingProducts = await db
      .select({ strProductId: tblProducts.strProductId })
      .from(tblProducts)
      .where(eq(tblProducts.strProductId, strProductId))
      .limit(1);

    if (arrExistingProducts.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Product not found'
      }, { status: 404 });
    }

    // Delete product
    await db
      .delete(tblProducts)
      .where(eq(tblProducts.strProductId, strProductId));

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
} 