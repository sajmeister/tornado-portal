import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../src/lib/db';
import { tblQuotes, tblOrders, tblPartners, tblUsers, tblPartnerUsers, tblQuoteItems, tblOrderItems, tblProducts } from '../../../src/lib/db/schema';
import { eq, and, sql, desc, count, sum } from 'drizzle-orm';
import { fnGetUserById } from '../../../src/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const strUserId = request.headers.get('x-user-id');
    
    if (!strUserId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const objUser = await fnGetUserById(strUserId);
    if (!objUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const strPeriod = searchParams.get('period') || '30'; // days

    // Calculate date range
    const dtEnd = new Date();
    const dtStart = new Date(Date.now() - parseInt(strPeriod) * 24 * 60 * 60 * 1000);

    let objAnalytics: any = {};

    // Provider Analytics (Super Admin and Provider User)
    if (objUser.strRole === 'super_admin' || objUser.strRole === 'provider_user') {
      // Overall sales metrics
      const arrOverallSales = await db
        .select({
          intTotalQuotes: count(tblQuotes.strQuoteId),
          intTotalOrders: count(tblOrders.strOrderId),
          decTotalRevenue: sum(tblOrders.decTotal),
          decTotalPartnerRevenue: sum(tblOrders.decSubtotal),
        })
        .from(tblOrders)
        .leftJoin(tblQuotes, eq(tblOrders.strQuoteId, tblQuotes.strQuoteId))
        .where(eq(tblOrders.bIsActive, true));

      // Sales by partner
      const arrSalesByPartner = await db
        .select({
          strPartnerId: tblPartners.strPartnerId,
          strPartnerName: tblPartners.strPartnerName,
          strPartnerCode: tblPartners.strPartnerCode,
          intQuotes: count(tblQuotes.strQuoteId),
          intOrders: count(tblOrders.strOrderId),
          decRevenue: sum(tblOrders.decTotal),
          decPartnerRevenue: sum(tblOrders.decSubtotal),
        })
        .from(tblPartners)
        .leftJoin(tblQuotes, eq(tblPartners.strPartnerId, tblQuotes.strPartnerId))
        .leftJoin(tblOrders, eq(tblQuotes.strQuoteId, tblOrders.strQuoteId))
        .where(
          and(
            eq(tblPartners.bIsActive, true),
            eq(tblQuotes.bIsActive, true)
          )
        )
        .groupBy(tblPartners.strPartnerId, tblPartners.strPartnerName, tblPartners.strPartnerCode);

      // Top products by sales
      const arrTopProducts = await db
        .select({
          strProductId: tblProducts.strProductId,
          strProductName: tblProducts.strProductName,
          strProductCode: tblProducts.strProductCode,
          intQuantitySold: sum(tblOrderItems.intQuantity),
          decRevenue: sum(tblOrderItems.decLineTotal),
        })
        .from(tblProducts)
        .leftJoin(tblOrderItems, eq(tblProducts.strProductId, tblOrderItems.strProductId))
        .leftJoin(tblOrders, eq(tblOrderItems.strOrderId, tblOrders.strOrderId))
        .where(
          and(
            eq(tblProducts.bIsActive, true),
            eq(tblOrders.bIsActive, true)
          )
        )
        .groupBy(tblProducts.strProductId, tblProducts.strProductName, tblProducts.strProductCode)
        .orderBy(desc(sum(tblOrderItems.decLineTotal)))
        .limit(10);

      // Monthly trend (last 12 months)
      const arrMonthlyTrend = await db
        .select({
          strMonth: sql<string>`strftime('%Y-%m', datetime("tblOrders"."dtCreated", 'unixepoch'))`,
          intOrders: count(tblOrders.strOrderId),
          decRevenue: sum(tblOrders.decTotal),
          decPartnerRevenue: sum(tblOrders.decSubtotal),
        })
        .from(tblOrders)
        .where(eq(tblOrders.bIsActive, true))
        .groupBy(sql`strftime('%Y-%m', datetime("tblOrders"."dtCreated", 'unixepoch'))`)
        .orderBy(sql`strftime('%Y-%m', datetime("tblOrders"."dtCreated", 'unixepoch'))`);

      objAnalytics = {
        strUserRole: objUser.strRole,
        strPeriod: strPeriod,
        dtStart: dtStart.toISOString(),
        dtEnd: dtEnd.toISOString(),
        objOverall: {
          intTotalQuotes: arrOverallSales[0]?.intTotalQuotes || 0,
          intTotalOrders: arrOverallSales[0]?.intTotalOrders || 0,
          decTotalRevenue: parseFloat(arrOverallSales[0]?.decTotalRevenue || '0'),
          decTotalPartnerRevenue: parseFloat(arrOverallSales[0]?.decTotalPartnerRevenue || '0'),
          decAverageOrderValue: arrOverallSales[0]?.intTotalOrders > 0 
            ? parseFloat(arrOverallSales[0]?.decTotalRevenue || '0') / arrOverallSales[0]?.intTotalOrders 
            : 0,
        },
        arrSalesByPartner: arrSalesByPartner.map(partner => ({
          ...partner,
          decRevenue: parseFloat(partner.decRevenue || '0'),
          decPartnerRevenue: parseFloat(partner.decPartnerRevenue || '0'),
        })),
        arrTopProducts: arrTopProducts.map(product => ({
          ...product,
          intQuantitySold: parseInt(product.intQuantitySold || '0'),
          decRevenue: parseFloat(product.decRevenue || '0'),
        })),
        arrMonthlyTrend: arrMonthlyTrend.map(month => ({
          ...month,
          decRevenue: parseFloat(month.decRevenue || '0'),
          decPartnerRevenue: parseFloat(month.decPartnerRevenue || '0'),
        })),
      };
    }
    // Partner Analytics (Partner Admin only - Partner Customers don't need sales analytics)
    else if (objUser.strRole === 'partner_admin') {
      // Get partner ID for the current user
      const arrPartnerUser = await db
        .select()
        .from(tblPartnerUsers)
        .where(
          and(
            eq(tblPartnerUsers.strUserId, objUser.strUserId),
            eq(tblPartnerUsers.bIsActive, true)
          )
        );

      if (arrPartnerUser.length === 0) {
        return NextResponse.json({ success: false, error: 'Partner not found' }, { status: 404 });
      }

      const strPartnerId = arrPartnerUser[0].strPartnerId;

      // Get partner details
      const arrPartner = await db
        .select()
        .from(tblPartners)
        .where(eq(tblPartners.strPartnerId, strPartnerId));

      if (arrPartner.length === 0) {
        return NextResponse.json({ success: false, error: 'Partner not found' }, { status: 404 });
      }

      const objPartner = arrPartner[0];

      // Partner's overall sales metrics
      const arrPartnerSales = await db
        .select({
          intTotalQuotes: count(tblQuotes.strQuoteId),
          intTotalOrders: count(tblOrders.strOrderId),
          decTotalRevenue: sum(tblOrders.decTotal),
          decTotalCustomerRevenue: sum(tblQuotes.decCustomerSubtotal),
          decTotalPartnerRevenue: sum(tblQuotes.decSubtotal),
        })
        .from(tblQuotes)
        .leftJoin(tblOrders, eq(tblQuotes.strQuoteId, tblOrders.strQuoteId))
        .where(
          and(
            eq(tblQuotes.strPartnerId, strPartnerId),
            eq(tblQuotes.bIsActive, true)
          )
        );

      // Sales by customer (for Partner Admin)
      let arrSalesByCustomer: any[] = [];
      if (objUser.strRole === 'partner_admin') {
        arrSalesByCustomer = await db
          .select({
            strCustomerId: tblUsers.strUserId,
            strCustomerName: tblUsers.strName,
            strCustomerEmail: tblUsers.strEmail,
            intQuotes: count(tblQuotes.strQuoteId),
            intOrders: count(tblOrders.strOrderId),
            decRevenue: sum(tblOrders.decTotal),
            decCustomerRevenue: sum(tblQuotes.decCustomerSubtotal),
            decPartnerRevenue: sum(tblQuotes.decSubtotal),
          })
          .from(tblUsers)
          .leftJoin(tblQuotes, eq(tblUsers.strUserId, tblQuotes.strCustomerId))
          .leftJoin(tblOrders, eq(tblQuotes.strQuoteId, tblOrders.strQuoteId))
          .where(
            and(
              eq(tblQuotes.strPartnerId, strPartnerId),
              eq(tblQuotes.bIsActive, true)
            )
          )
          .groupBy(tblUsers.strUserId, tblUsers.strName, tblUsers.strEmail);
      }

      // Top products by sales for this partner
      const arrTopProducts = await db
        .select({
          strProductId: tblProducts.strProductId,
          strProductName: tblProducts.strProductName,
          strProductCode: tblProducts.strProductCode,
          intQuantitySold: sum(tblQuoteItems.intQuantity),
          decRevenue: sum(tblQuoteItems.decCustomerLineTotal),
          decPartnerRevenue: sum(tblQuoteItems.decLineTotal),
        })
        .from(tblProducts)
        .leftJoin(tblQuoteItems, eq(tblProducts.strProductId, tblQuoteItems.strProductId))
        .leftJoin(tblQuotes, eq(tblQuoteItems.strQuoteId, tblQuotes.strQuoteId))
        .where(
          and(
            eq(tblProducts.bIsActive, true),
            eq(tblQuotes.strPartnerId, strPartnerId),
            eq(tblQuotes.bIsActive, true)
          )
        )
        .groupBy(tblProducts.strProductId, tblProducts.strProductName, tblProducts.strProductCode)
        .orderBy(desc(sum(tblQuoteItems.decCustomerLineTotal)))
        .limit(10);

      // Monthly trend for this partner
      const arrMonthlyTrend = await db
        .select({
          strMonth: sql<string>`strftime('%Y-%m', datetime("tblQuotes"."dtCreated", 'unixepoch'))`,
          intQuotes: count(tblQuotes.strQuoteId),
          intOrders: count(tblOrders.strOrderId),
          decRevenue: sum(tblOrders.decTotal),
          decCustomerRevenue: sum(tblQuotes.decCustomerSubtotal),
          decPartnerRevenue: sum(tblQuotes.decSubtotal),
        })
        .from(tblQuotes)
        .leftJoin(tblOrders, eq(tblQuotes.strQuoteId, tblOrders.strQuoteId))
        .where(
          and(
            eq(tblQuotes.strPartnerId, strPartnerId),
            eq(tblQuotes.bIsActive, true)
          )
        )
        .groupBy(sql`strftime('%Y-%m', datetime("tblQuotes"."dtCreated", 'unixepoch'))`)
        .orderBy(sql`strftime('%Y-%m', datetime("tblQuotes"."dtCreated", 'unixepoch'))`);

      objAnalytics = {
        strUserRole: objUser.strRole,
        strPeriod: strPeriod,
        dtStart: dtStart.toISOString(),
        dtEnd: dtEnd.toISOString(),
        objPartner: {
          strPartnerId: objPartner.strPartnerId,
          strPartnerName: objPartner.strPartnerName,
          strPartnerCode: objPartner.strPartnerCode,
        },
        objOverall: {
          intTotalQuotes: arrPartnerSales[0]?.intTotalQuotes || 0,
          intTotalOrders: arrPartnerSales[0]?.intTotalOrders || 0,
          decTotalRevenue: parseFloat(arrPartnerSales[0]?.decTotalRevenue || '0'),
          decTotalCustomerRevenue: parseFloat(arrPartnerSales[0]?.decTotalCustomerRevenue || '0'),
          decTotalPartnerRevenue: parseFloat(arrPartnerSales[0]?.decTotalPartnerRevenue || '0'),
          decAverageOrderValue: arrPartnerSales[0]?.intTotalOrders > 0 
            ? parseFloat(arrPartnerSales[0]?.decTotalRevenue || '0') / arrPartnerSales[0]?.intTotalOrders 
            : 0,
          decProfitMargin: parseFloat(arrPartnerSales[0]?.decTotalCustomerRevenue || '0') > 0 
            ? ((parseFloat(arrPartnerSales[0]?.decTotalCustomerRevenue || '0') - parseFloat(arrPartnerSales[0]?.decTotalPartnerRevenue || '0')) / parseFloat(arrPartnerSales[0]?.decTotalCustomerRevenue || '0')) * 100
            : 0,
        },
        arrSalesByCustomer: arrSalesByCustomer.map(customer => ({
          ...customer,
          decRevenue: parseFloat(customer.decRevenue || '0'),
          decCustomerRevenue: parseFloat(customer.decCustomerRevenue || '0'),
          decPartnerRevenue: parseFloat(customer.decPartnerRevenue || '0'),
        })),
        arrTopProducts: arrTopProducts.map(product => ({
          ...product,
          intQuantitySold: parseInt(product.intQuantitySold || '0'),
          decRevenue: parseFloat(product.decRevenue || '0'),
          decPartnerRevenue: parseFloat(product.decPartnerRevenue || '0'),
        })),
        arrMonthlyTrend: arrMonthlyTrend.map(month => ({
          ...month,
          decRevenue: parseFloat(month.decRevenue || '0'),
          decCustomerRevenue: parseFloat(month.decCustomerRevenue || '0'),
          decPartnerRevenue: parseFloat(month.decPartnerRevenue || '0'),
        })),
      };
    }

    return NextResponse.json({ success: true, data: objAnalytics });
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
} 