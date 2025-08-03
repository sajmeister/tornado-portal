import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { tblQuotes, tblUsers } from '@/src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { fnHasPermission } from '@/src/lib/roles';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
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

    const { quoteId: strQuoteId } = await params;
    const objBody = await request.json();
    const { strStatus, strNotes } = objBody;

    if (!strStatus) {
      return NextResponse.json({
        success: false,
        message: 'Status is required'
      }, { status: 400 });
    }

    // Validate status
    const arrValidStatuses = ['draft', 'sent', 'approved', 'rejected'];
    if (!arrValidStatuses.includes(strStatus.toLowerCase())) {
      return NextResponse.json({
        success: false,
        message: 'Invalid status. Valid statuses are: draft, sent, approved, rejected'
      }, { status: 400 });
    }

    // Check permissions based on status change
    if (strStatus.toLowerCase() === 'approved' || strStatus.toLowerCase() === 'rejected') {
      // Only Super Admin and Provider User can approve/reject quotes
      if (!objUser.strRole || !fnHasPermission(objUser.strRole, 'quote:manage')) {
        return NextResponse.json({
          success: false,
          message: 'Access denied. Only Super Admin and Provider User can approve or reject quotes.'
        }, { status: 403 });
      }
    }

    // Get the quote and verify it exists
    const arrQuotes = await db.select().from(tblQuotes).where(eq(tblQuotes.strQuoteId, strQuoteId));
    if (arrQuotes.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Quote not found'
      }, { status: 404 });
    }

    const objQuote = arrQuotes[0];

    // Check if quote is active
    if (!objQuote.bIsActive) {
      return NextResponse.json({
        success: false,
        message: 'Quote is not active'
      }, { status: 400 });
    }

    // Check if status is already the same
    if (objQuote.strStatus.toLowerCase() === strStatus.toLowerCase()) {
      return NextResponse.json({
        success: false,
        message: 'Quote is already in this status'
      }, { status: 400 });
    }

    // Update quote status
    await db
      .update(tblQuotes)
      .set({
        strStatus: strStatus.toLowerCase(),
        strNotes: strNotes || objQuote.strNotes,
        dtUpdated: new Date(),
      })
      .where(eq(tblQuotes.strQuoteId, strQuoteId));

    return NextResponse.json({
      success: true,
      message: 'Quote status updated successfully',
      quote: {
        strQuoteId,
        strStatus: strStatus.toLowerCase(),
        strNotes: strNotes || objQuote.strNotes,
        dtUpdated: new Date(),
      }
    });

  } catch (error) {
    console.error('Error updating quote status:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
} 