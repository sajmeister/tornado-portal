import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { tblProducts } from '@/src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { fnHasPermission } from '@/src/lib/roles';

// Helper function to check for circular dependencies
async function fnCheckCircularDependency(strProductId: string, strDependencyId: string): Promise<boolean> {
  const arrVisited = new Set<string>();
  let strCurrentId = strDependencyId;
  
  while (strCurrentId) {
    if (arrVisited.has(strCurrentId)) {
      return true; // Circular dependency detected
    }
    
    if (strCurrentId === strProductId) {
      return true; // Self-dependency detected
    }
    
    arrVisited.add(strCurrentId);
    
    // Get the dependency of the current product
    const arrCurrentProduct = await db
      .select({ strDependencyId: tblProducts.strDependencyId })
      .from(tblProducts)
      .where(eq(tblProducts.strProductId, strCurrentId));
    
    if (arrCurrentProduct.length === 0) {
      break; // Product not found
    }
    
    strCurrentId = arrCurrentProduct[0].strDependencyId || '';
  }
  
  return false; // No circular dependency
}

// Check if user has permission to manage products
function fnCanManageProducts(strRole: string): boolean {
  return fnHasPermission(strRole, 'product:manage');
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
    const { strProductName, strDescription, decBasePrice, strCategory, bIsActive, strDependencyId } = objBody;

    // Build update object with only provided fields
    const objUpdateData: any = {};
    
    if (strProductName !== undefined) objUpdateData.strProductName = strProductName;
    if (strDescription !== undefined) objUpdateData.strDescription = strDescription;
    if (decBasePrice !== undefined) {
      objUpdateData.decBasePrice = decBasePrice;
      objUpdateData.decPartnerPrice = decBasePrice * 0.9; // 10% discount for partners
    }
    if (strCategory !== undefined) objUpdateData.strCategory = strCategory;
    if (bIsActive !== undefined) objUpdateData.bIsActive = bIsActive;
    if (strDependencyId !== undefined) {
      // Validate dependency if provided
      if (strDependencyId) {
        const arrDependencyProduct = await db
          .select()
          .from(tblProducts)
          .where(eq(tblProducts.strProductId, strDependencyId));
        
        if (arrDependencyProduct.length === 0) {
          return NextResponse.json({
            success: false,
            message: 'Dependency product not found'
          }, { status: 400 });
        }

        // Check for circular dependencies
        const bHasCircularDependency = await fnCheckCircularDependency(strProductId, strDependencyId);
        if (bHasCircularDependency) {
          return NextResponse.json({
            success: false,
            message: 'Circular dependency detected. This would create an infinite dependency chain.'
          }, { status: 400 });
        }
      }
      objUpdateData.strDependencyId = strDependencyId || null;
    }
    
    objUpdateData.dtUpdated = new Date();

    // Update product
    const arrUpdatedProducts = await db
      .update(tblProducts)
      .set(objUpdateData)
      .where(eq(tblProducts.strProductId, strProductId))
      .returning({
        strProductId: tblProducts.strProductId,
        strProductName: tblProducts.strProductName,
        strDescription: tblProducts.strDescription,
        decBasePrice: tblProducts.decBasePrice,
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