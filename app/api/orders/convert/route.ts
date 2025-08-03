import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { tblOrders, tblOrderItems, tblQuotes, tblQuoteItems, tblUsers, tblOrderStatusHistory } from '@/src/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { fnHasPermission } from '@/src/lib/roles';

export async function POST(request: NextRequest) {
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

    // Check if user has permission to manage orders
    if (!objUser.strRole || !fnHasPermission(objUser.strRole, 'order:manage')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Access denied. You do not have permission to manage orders.' 
      }, { status: 403 });
    }

    const objBody = await request.json();
    const { strQuoteId } = objBody;

    if (!strQuoteId) {
      return NextResponse.json({
        success: false,
        message: 'Quote ID is required'
      }, { status: 400 });
    }

    // Get the quote and verify it exists and is approved
    const arrQuotes = await db.select().from(tblQuotes).where(eq(tblQuotes.strQuoteId, strQuoteId));
    if (arrQuotes.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Quote not found'
      }, { status: 404 });
    }

    const objQuote = arrQuotes[0];

    // Check if quote is approved
    if (objQuote.strStatus !== 'approved') {
      return NextResponse.json({
        success: false,
        message: 'Only approved quotes can be converted to orders'
      }, { status: 400 });
    }

    // Check if quote is active
    if (!objQuote.bIsActive) {
      return NextResponse.json({
        success: false,
        message: 'Quote is not active'
      }, { status: 400 });
    }

    // Check if order already exists for this quote
    const arrExistingOrders = await db.select().from(tblOrders).where(eq(tblOrders.strQuoteId, strQuoteId));
    if (arrExistingOrders.length > 0) {
      return NextResponse.json({
        success: false,
        message: 'Order already exists for this quote'
      }, { status: 400 });
    }

    // Get quote items
    const arrQuoteItems = await db.select().from(tblQuoteItems).where(eq(tblQuoteItems.strQuoteId, strQuoteId));

    // Generate order ID and order number
    const strOrderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const strOrderNumber = `ORD-${Date.now()}`;

    // Create the order
    const arrNewOrders = await db
      .insert(tblOrders)
      .values({
        strOrderId,
        strOrderNumber,
        strQuoteId,
        strPartnerId: objQuote.strPartnerId,
        strCreatedBy: strUserIdNonNull,
        strStatus: 'pending',
        decSubtotal: objQuote.decSubtotal,
        decDiscountAmount: objQuote.decDiscountAmount,
        decTotal: objQuote.decTotal,
        strNotes: objQuote.strNotes,
        dtCreated: new Date(),
        dtUpdated: new Date(),
        bIsActive: true,
      })
      .returning();

    if (arrNewOrders.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Failed to create order'
      }, { status: 500 });
    }

    // Create order items from quote items
    const arrOrderItemsToInsert = arrQuoteItems.map((objQuoteItem) => ({
      strOrderItemId: `orderitem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      strOrderId,
      strProductId: objQuoteItem.strProductId,
      intQuantity: objQuoteItem.intQuantity,
      decUnitPrice: objQuoteItem.decUnitPrice,
      decLineTotal: objQuoteItem.decLineTotal,
      strNotes: objQuoteItem.strNotes,
      dtCreated: new Date(),
      bIsActive: true,
    }));

    if (arrOrderItemsToInsert.length > 0) {
      await db.insert(tblOrderItems).values(arrOrderItemsToInsert);
    }

    // Create initial status history entry
    const strStatusHistoryId = `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.insert(tblOrderStatusHistory).values({
      strStatusHistoryId,
      strOrderId,
      strStatus: 'pending',
      strNotes: 'Order created from approved quote',
      strUpdatedBy: strUserIdNonNull,
      dtCreated: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'Quote successfully converted to order',
      order: {
        strOrderId,
        strOrderNumber,
        strQuoteId,
        strPartnerId: objQuote.strPartnerId,
        strStatus: 'pending',
        decTotal: objQuote.decTotal,
      }
    });

  } catch (error) {
    console.error('Error converting quote to order:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
} 