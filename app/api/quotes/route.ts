import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { tblQuotes, tblQuoteItems, tblProducts, tblUsers, tblPartners, tblOrders } from '@/src/lib/db/schema';
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

    // Get quotes based on user role and partner isolation
    let arrQuotes;
    if (objUser.strRole && fnCanBypassPartnerIsolation(objUser.strRole)) {
      // Admin/Provider users can see all quotes
      arrQuotes = await db.select().from(tblQuotes).where(eq(tblQuotes.bIsActive, true)).orderBy(desc(tblQuotes.dtCreated));
    } else {
      // Partner users can see quotes from their partner, but with special filtering for draft quotes
      const strPartnerId = await fnGetUserPartnerId(strUserIdNonNull);
      if (!strPartnerId) {
        return NextResponse.json({ success: false, error: 'User not associated with any partner' }, { status: 403 });
      }
      
      // Get all quotes for this partner
      arrQuotes = await db.select().from(tblQuotes).where(
        and(
          eq(tblQuotes.strPartnerId, strPartnerId), 
          eq(tblQuotes.bIsActive, true)
        )
      ).orderBy(desc(tblQuotes.dtCreated));
      
      // Filter quotes: Partners can see their own draft quotes, but not draft quotes created by Provider users
      arrQuotes = arrQuotes.filter(quote => {
        // If quote is not in draft status, show it
        if (!quote.strStatus || quote.strStatus.toLowerCase() !== 'draft') {
          return true;
        }
        
        // If quote is in draft status, only show it if the Partner created it themselves
        // (i.e., the creator is not a Provider user)
        return quote.strCreatedBy === strUserIdNonNull;
      });
    }

    // Get quote items and partner info for each quote
    const arrQuotesWithItems = await Promise.all(
      arrQuotes.map(async (objQuote) => {
        // Get quote items
        const arrQuoteItems = await db.select({
          strQuoteItemId: tblQuoteItems.strQuoteItemId,
          strProductId: tblQuoteItems.strProductId,
          intQuantity: tblQuoteItems.intQuantity,
          decUnitPrice: tblQuoteItems.decUnitPrice,
          decLineTotal: tblQuoteItems.decLineTotal,
          strNotes: tblQuoteItems.strNotes,
          strProductName: tblProducts.strProductName,
          strProductCode: tblProducts.strProductCode,
        })
        .from(tblQuoteItems)
        .leftJoin(tblProducts, eq(tblQuoteItems.strProductId, tblProducts.strProductId))
        .where(eq(tblQuoteItems.strQuoteId, objQuote.strQuoteId));

        // Get partner info
        const arrPartners = await db.select({
          strPartnerName: tblPartners.strPartnerName,
          strPartnerCode: tblPartners.strPartnerCode,
        })
        .from(tblPartners)
        .where(eq(tblPartners.strPartnerId, objQuote.strPartnerId));

        const objPartner = arrPartners[0] || { strPartnerName: 'Unknown Partner', strPartnerCode: 'UNK' };

        // Check if order already exists for this quote
        const arrExistingOrders = await db.select().from(tblOrders).where(eq(tblOrders.strQuoteId, objQuote.strQuoteId));
        const bHasOrder = arrExistingOrders.length > 0;

        return {
          ...objQuote,
          arrItems: arrQuoteItems,
          objPartner: objPartner,
          bHasOrder: bHasOrder
        };
      })
    );

    return NextResponse.json({
      success: true,
      quotes: arrQuotesWithItems
    });

  } catch (error) {
    console.error('Error fetching quotes:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

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

    // Check if user has permission to create quotes
    const arrAllowedRoles = ['super_admin', 'provider_user', 'partner_admin', 'partner_user'];
    if (!objUser.strRole || !arrAllowedRoles.includes(objUser.strRole)) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const objBody = await request.json();
    const { strNotes, dtValidUntil, arrItems } = objBody;

    // Validate required fields
    if (!dtValidUntil || !arrItems || arrItems.length === 0) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Validate items
    for (const objItem of arrItems) {
      if (!objItem.strProductId || !objItem.intQuantity || !objItem.decUnitPrice) {
        return NextResponse.json({ success: false, error: 'Invalid quote items' }, { status: 400 });
      }
      
      // For partner users, validate customer pricing
      if (objUser.strRole === 'partner_admin' || objUser.strRole === 'partner_user') {
        if (!objItem.decCustomerUnitPrice) {
          return NextResponse.json({ success: false, error: 'Customer pricing required for partner users' }, { status: 400 });
        }
        
        // Ensure customer price doesn't exceed partner price
        if (objItem.decCustomerUnitPrice > objItem.decUnitPrice) {
          return NextResponse.json({ success: false, error: 'Customer price cannot exceed partner price' }, { status: 400 });
        }
      }
    }

    // Determine partner ID for the quote
    let strPartnerId: string;
    
    if (fnCanBypassPartnerIsolation(objUser.strRole)) {
      // For Super Admin/Provider users, use the first available partner as default
      // or allow them to specify a partner ID in the request body
      const { strPartnerId: strRequestedPartnerId } = objBody;
      
      if (strRequestedPartnerId) {
        // Validate that the requested partner exists
        const arrPartners = await db.select().from(tblPartners).where(eq(tblPartners.strPartnerId, strRequestedPartnerId));
        if (arrPartners.length === 0) {
          return NextResponse.json({ success: false, error: 'Invalid partner ID' }, { status: 400 });
        }
        strPartnerId = strRequestedPartnerId;
      } else {
        // Use the first available partner as default
        const arrPartners = await db.select().from(tblPartners).where(eq(tblPartners.bIsActive, true)).limit(1);
        if (arrPartners.length === 0) {
          return NextResponse.json({ success: false, error: 'No active partners found' }, { status: 500 });
        }
        strPartnerId = arrPartners[0].strPartnerId;
      }
    } else {
      // For Partner users, get their associated partner
      const strUserPartnerId = await fnGetUserPartnerId(strUserIdNonNull);
      if (!strUserPartnerId) {
        return NextResponse.json({ success: false, error: 'User not associated with any partner' }, { status: 403 });
      }
      strPartnerId = strUserPartnerId;
    }

    // Generate quote number (Q-YYYYMMDD-XXXX format)
    const dtNow = new Date();
    const strDate = dtNow.toISOString().slice(0, 10).replace(/-/g, '');
    const intRandom = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const strQuoteNumber = `Q-${strDate}-${intRandom}`;

    // Calculate totals
    const decSubtotal = arrItems.reduce((total: number, item: { intQuantity: number; decUnitPrice: number }) => 
      total + (item.intQuantity * item.decUnitPrice), 0);
    
    // For partner users, calculate customer totals; for others, customer = partner
    const decCustomerSubtotal = arrItems.reduce((total: number, item: any) => {
      const decCustomerPrice = item.decCustomerUnitPrice || item.decUnitPrice;
      return total + (item.intQuantity * decCustomerPrice);
    }, 0);
    
    const decDiscountAmount = 0; // For now, no additional discount applied
    const decTotal = decCustomerSubtotal - decDiscountAmount; // Customer total
    const decPartnerTotal = decSubtotal - decDiscountAmount; // Partner total (what provider gets paid)

    // Create the quote
    const objNewQuote = {
      strQuoteId: `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      strQuoteNumber,
      strPartnerId,
      strCreatedBy: strUserIdNonNull,
      strStatus: 'draft',
      decSubtotal,
      decCustomerSubtotal,
      decDiscountAmount,
      decTotal,
      decPartnerTotal,
      strNotes: strNotes || '',
      dtValidUntil: new Date(dtValidUntil),
      dtCreated: dtNow,
      dtUpdated: dtNow,
      bIsActive: true,
    };

    // Insert quote
    await db.insert(tblQuotes).values(objNewQuote);

    // Insert quote items
    const arrQuoteItems = arrItems.map((objItem: any, intIndex: number) => {
      const decCustomerUnitPrice = objItem.decCustomerUnitPrice || objItem.decUnitPrice;
      
      return {
        strQuoteItemId: `quote_item_${Date.now()}_${intIndex}_${Math.random().toString(36).substr(2, 9)}`,
        strQuoteId: objNewQuote.strQuoteId,
        strProductId: objItem.strProductId,
        intQuantity: objItem.intQuantity,
        decUnitPrice: objItem.decUnitPrice,
        decCustomerUnitPrice: decCustomerUnitPrice,
        decLineTotal: objItem.intQuantity * objItem.decUnitPrice,
        decCustomerLineTotal: objItem.intQuantity * decCustomerUnitPrice,
        strNotes: objItem.strNotes || '',
        dtCreated: dtNow,
        bIsActive: true,
      };
    });

    await db.insert(tblQuoteItems).values(arrQuoteItems);

    return NextResponse.json({
      success: true,
      message: 'Quote created successfully',
      quote: objNewQuote
    });

  } catch (error) {
    console.error('Error creating quote:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
} 