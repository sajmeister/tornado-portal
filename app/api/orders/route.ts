import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { tblOrders, tblOrderItems, tblProducts, tblUsers, tblPartners } from '@/src/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { fnGetUserPartnerId, fnCanBypassPartnerIsolation } from '@/src/lib/partners';

export async function GET(request: NextRequest) {
  try {
    // Get user info from middleware headers
    const strUserId = request.headers.get('x-user-id');
    
    if (!strUserId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    
    // Type assertion since we've already checked for null
    const strUserIdNonNull = strUserId as string;

    // Get user details
    const arrUsers = await db.select().from(tblUsers).where(eq(tblUsers.strUserId, strUserIdNonNull));
    if (arrUsers.length === 0) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const objUser = arrUsers[0];

    // Get orders based on user role and partner isolation
    let arrOrders;
    if (objUser.strRole && fnCanBypassPartnerIsolation(objUser.strRole)) {
      // Admin/Provider users can see all orders
      arrOrders = await db.select().from(tblOrders).where(eq(tblOrders.bIsActive, true)).orderBy(desc(tblOrders.dtCreated));
    } else {
      // Partner users can only see orders from their partner
      const strPartnerId = await fnGetUserPartnerId(strUserIdNonNull);
      if (!strPartnerId) {
        return NextResponse.json({ success: false, error: 'User not associated with any partner' }, { status: 403 });
      }
      
      arrOrders = await db.select().from(tblOrders).where(
        and(
          eq(tblOrders.strPartnerId, strPartnerId), 
          eq(tblOrders.bIsActive, true)
        )
      ).orderBy(desc(tblOrders.dtCreated));
    }

    // Get order items and partner information for each order
    const arrOrdersWithDetails = await Promise.all(
      arrOrders.map(async (objOrder) => {
        // Get order items
        const arrOrderItems = await db.select({
          strOrderItemId: tblOrderItems.strOrderItemId,
          strProductId: tblOrderItems.strProductId,
          intQuantity: tblOrderItems.intQuantity,
          decUnitPrice: tblOrderItems.decUnitPrice,
          decLineTotal: tblOrderItems.decLineTotal,
          strNotes: tblOrderItems.strNotes,
          strProductName: tblProducts.strProductName,
          strProductCode: tblProducts.strProductCode,
        })
        .from(tblOrderItems)
        .leftJoin(tblProducts, eq(tblOrderItems.strProductId, tblProducts.strProductId))
        .where(eq(tblOrderItems.strOrderId, objOrder.strOrderId));

        // Get partner information
        const arrPartner = await db.select({
          strPartnerName: tblPartners.strPartnerName,
        })
        .from(tblPartners)
        .where(eq(tblPartners.strPartnerId, objOrder.strPartnerId));

        // Get creator information
        const arrCreator = await db.select({
          strName: tblUsers.strName,
        })
        .from(tblUsers)
        .where(eq(tblUsers.strUserId, objOrder.strCreatedBy));

        return {
          ...objOrder,
          arrItems: arrOrderItems,
          strPartnerName: arrPartner[0]?.strPartnerName || 'Unknown Partner',
          strCreatedByName: arrCreator[0]?.strName || 'Unknown User',
          arrStatusHistory: [] // TODO: Implement status history
        };
      })
    );

    return NextResponse.json({
      success: true,
      orders: arrOrdersWithDetails
    });

  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
} 