import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { tblOrders, tblOrderStatusHistory, tblUsers } from '@/src/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { fnHasPermission } from '@/src/lib/roles';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
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

    const { orderId: strOrderId } = await params;
    const objBody = await request.json();
    const { strStatus, strNotes } = objBody;

    if (!strStatus) {
      return NextResponse.json({
        success: false,
        message: 'Status is required'
      }, { status: 400 });
    }

    // Validate status
    const arrValidStatuses = [
      'pending', 
      'confirmed', 
      'processing', 
      'provisioning', 
      'testing', 
      'ready', 
      'shipped', 
      'delivered', 
      'cancelled'
    ];
    if (!arrValidStatuses.includes(strStatus.toLowerCase())) {
      return NextResponse.json({
        success: false,
        message: `Invalid status. Valid statuses are: ${arrValidStatuses.join(', ')}`
      }, { status: 400 });
    }

    // Get the order and verify it exists
    const arrOrders = await db.select().from(tblOrders).where(eq(tblOrders.strOrderId, strOrderId));
    if (arrOrders.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Order not found'
      }, { status: 404 });
    }

    const objOrder = arrOrders[0];

    // Check if order is active
    if (!objOrder.bIsActive) {
      return NextResponse.json({
        success: false,
        message: 'Order is not active'
      }, { status: 400 });
    }

    // Check if status is already the same
    if (objOrder.strStatus.toLowerCase() === strStatus.toLowerCase()) {
      return NextResponse.json({
        success: false,
        message: 'Order is already in this status'
      }, { status: 400 });
    }

    // Update order status
    await db
      .update(tblOrders)
      .set({
        strStatus: strStatus.toLowerCase(),
        dtUpdated: new Date(),
      })
      .where(eq(tblOrders.strOrderId, strOrderId));

    // Create status history entry
    const strStatusHistoryId = `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.insert(tblOrderStatusHistory).values({
      strStatusHistoryId,
      strOrderId,
      strStatus: strStatus.toLowerCase(),
      strNotes: strNotes || `Status updated to ${strStatus.toLowerCase()}`,
      strUpdatedBy: strUserIdNonNull,
      dtCreated: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'Order status updated successfully',
      order: {
        strOrderId,
        strStatus: strStatus.toLowerCase(),
        dtUpdated: new Date(),
      }
    });

  } catch (error) {
    console.error('Error updating order status:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
} 