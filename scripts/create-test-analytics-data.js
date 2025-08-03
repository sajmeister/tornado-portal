const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env.local' });

// Database connection
const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function fnCreateTestAnalyticsData() {
  try {
    console.log('🔄 Creating test analytics data...');

    // Get existing data
    const arrProducts = await client.execute('SELECT * FROM tblProducts WHERE bIsActive = 1');
    const arrPartners = await client.execute('SELECT * FROM tblPartners WHERE bIsActive = 1');
    const arrUsers = await client.execute('SELECT * FROM tblUsers WHERE bIsActive = 1');

    if (arrProducts.rows.length === 0 || arrPartners.rows.length === 0 || arrUsers.rows.length === 0) {
      console.log('❌ Missing required data: products, partners, or users');
      return;
    }

    console.log(`📊 Found ${arrProducts.rows.length} products, ${arrPartners.rows.length} partners, ${arrUsers.rows.length} users`);

    // Get partner customers (users with partner roles)
    const arrPartnerCustomers = arrUsers.rows.filter(user => 
      user.strRole === 'partner_customer' || user.strRole === 'partner_admin'
    );

    if (arrPartnerCustomers.length === 0) {
      console.log('❌ No partner customers found for analytics data');
      return;
    }

    // Generate quotes and orders for the last 90 days
    const dtNow = new Date();
    const dtStart = new Date(dtNow.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days ago

    let intQuoteCounter = 1;
    let intOrderCounter = 1;

    // Create quotes and orders for each partner
    for (const objPartner of arrPartners.rows) {
      console.log(`📈 Creating data for partner: ${objPartner.strPartnerName}`);

      // Get partner customers for this partner
      const arrPartnerUsers = arrPartnerCustomers.filter(user => 
        user.strRole === 'partner_customer' || user.strRole === 'partner_admin'
      );

      if (arrPartnerUsers.length === 0) continue;

      // Create 10-20 quotes per partner over the last 90 days
      const intQuotesToCreate = Math.floor(Math.random() * 11) + 10; // 10-20 quotes

      for (let i = 0; i < intQuotesToCreate; i++) {
        // Random date within the last 90 days
        const dtQuoteDate = new Date(dtStart.getTime() + Math.random() * (dtNow.getTime() - dtStart.getTime()));
        const intQuoteTimestamp = Math.floor(dtQuoteDate.getTime() / 1000);

        // Random customer
        const objCustomer = arrPartnerUsers[Math.floor(Math.random() * arrPartnerUsers.length)];
        
        // Random creator (partner admin or provider user)
        const arrCreators = arrUsers.rows.filter(user => 
          user.strRole === 'partner_admin' || user.strRole === 'super_admin' || user.strRole === 'provider_user'
        );
        const objCreator = arrCreators[Math.floor(Math.random() * arrCreators.length)];

        // Random status (weighted towards completed orders)
        const arrStatuses = ['draft', 'sent', 'approved', 'rejected'];
        const strStatus = arrStatuses[Math.floor(Math.random() * arrStatuses.length)];

        // Create quote
        const strQuoteId = `quote_${Date.now()}_${intQuoteCounter++}`;
        const strQuoteNumber = `Q-${objPartner.strPartnerCode}-${String(intQuoteCounter).padStart(4, '0')}`;

        // Random products (1-3 products per quote)
        const intProductCount = Math.floor(Math.random() * 3) + 1;
        const arrSelectedProducts = [];
        for (let j = 0; j < intProductCount; j++) {
          const objProduct = arrProducts.rows[Math.floor(Math.random() * arrProducts.rows.length)];
          if (!arrSelectedProducts.find(p => p.strProductId === objProduct.strProductId)) {
            arrSelectedProducts.push(objProduct);
          }
        }

        // Calculate totals
        let decSubtotal = 0;
        let decCustomerSubtotal = 0;
        let decDiscountAmount = 0;

        // Create quote items
        const arrQuoteItems = [];
        for (const objProduct of arrSelectedProducts) {
          const intQuantity = Math.floor(Math.random() * 5) + 1; // 1-5 quantity
          const decPartnerUnitPrice = objProduct.decBasePrice * 0.8; // 20% partner discount
          const decCustomerUnitPrice = objProduct.decBasePrice * (0.9 + Math.random() * 0.2); // 90-110% of base price
          
          const decLineTotal = decPartnerUnitPrice * intQuantity;
          const decCustomerLineTotal = decCustomerUnitPrice * intQuantity;

          decSubtotal += decLineTotal;
          decCustomerSubtotal += decCustomerLineTotal;

          arrQuoteItems.push({
            strQuoteItemId: `quote_item_${Date.now()}_${Math.random()}`,
            strQuoteId,
            strProductId: objProduct.strProductId,
            intQuantity,
            decUnitPrice: decPartnerUnitPrice,
            decCustomerUnitPrice,
            decLineTotal,
            decCustomerLineTotal,
            strNotes: '',
            dtCreated: intQuoteTimestamp,
            bIsActive: 1
          });
        }

        decDiscountAmount = decCustomerSubtotal * 0.05; // 5% discount
        const decTotal = decCustomerSubtotal - decDiscountAmount;
        const decPartnerTotal = decSubtotal;

        // Insert quote
        await client.execute({
          sql: `INSERT INTO tblQuotes (
            strQuoteId, strQuoteNumber, strPartnerId, strCustomerId, strCreatedBy, strStatus,
            decSubtotal, decCustomerSubtotal, decDiscountAmount, decTotal, decPartnerTotal,
            strNotes, dtValidUntil, dtCreated, dtUpdated, bIsActive
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            strQuoteId, strQuoteNumber, objPartner.strPartnerId, objCustomer.strUserId, objCreator.strUserId, strStatus,
            decSubtotal, decCustomerSubtotal, decDiscountAmount, decTotal, decPartnerTotal,
            `Test quote ${intQuoteCounter}`, intQuoteTimestamp + (30 * 24 * 60 * 60), intQuoteTimestamp, intQuoteTimestamp, 1
          ]
        });

        // Insert quote items
        for (const objQuoteItem of arrQuoteItems) {
          await client.execute({
            sql: `INSERT INTO tblQuoteItems (
              strQuoteItemId, strQuoteId, strProductId, intQuantity, decUnitPrice, decCustomerUnitPrice,
              decLineTotal, decCustomerLineTotal, strNotes, dtCreated, bIsActive
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              objQuoteItem.strQuoteItemId, objQuoteItem.strQuoteId, objQuoteItem.strProductId, objQuoteItem.intQuantity,
              objQuoteItem.decUnitPrice, objQuoteItem.decCustomerUnitPrice, objQuoteItem.decLineTotal, objQuoteItem.decCustomerLineTotal,
              objQuoteItem.strNotes, objQuoteItem.dtCreated, objQuoteItem.bIsActive
            ]
          });
        }

        // Create order if quote is approved (60% of quotes)
        if (strStatus === 'approved' && Math.random() < 0.8) { // 80% of approved quotes become orders
          const dtOrderDate = new Date(dtQuoteDate.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000); // 0-7 days after quote
          const intOrderTimestamp = Math.floor(dtOrderDate.getTime() / 1000);

          const strOrderId = `order_${Date.now()}_${intOrderCounter++}`;
          const strOrderNumber = `O-${objPartner.strPartnerCode}-${String(intOrderCounter).padStart(4, '0')}`;

          // Random order status (weighted towards completed)
          const arrOrderStatuses = ['pending', 'confirmed', 'processing', 'testing', 'ready', 'shipped', 'delivered'];
          const strOrderStatus = arrOrderStatuses[Math.floor(Math.random() * arrOrderStatuses.length)];

          // Insert order
          await client.execute({
            sql: `INSERT INTO tblOrders (
              strOrderId, strOrderNumber, strQuoteId, strPartnerId, strCreatedBy, strStatus,
              decSubtotal, decDiscountAmount, decTotal, strShippingAddress, strBillingAddress,
              strNotes, dtExpectedDelivery, dtCreated, dtUpdated, bIsActive
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              strOrderId, strOrderNumber, strQuoteId, objPartner.strPartnerId, objCreator.strUserId, strOrderStatus,
              decSubtotal, decDiscountAmount, decTotal, '123 Test Street, Test City, TC 12345', '123 Test Street, Test City, TC 12345',
              `Test order ${intOrderCounter}`, intOrderTimestamp + (14 * 24 * 60 * 60), intOrderTimestamp, intOrderTimestamp, 1
            ]
          });

          // Create order items
          for (const objQuoteItem of arrQuoteItems) {
            await client.execute({
              sql: `INSERT INTO tblOrderItems (
                strOrderItemId, strOrderId, strProductId, intQuantity, decUnitPrice, decLineTotal, strNotes, dtCreated, bIsActive
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [
                `order_item_${Date.now()}_${Math.random()}`, strOrderId, objQuoteItem.strProductId, objQuoteItem.intQuantity,
                objQuoteItem.decUnitPrice, objQuoteItem.decLineTotal, '', intOrderTimestamp, 1
              ]
            });
          }

          // Create order status history
          await client.execute({
            sql: `INSERT INTO tblOrderStatusHistory (
              strStatusHistoryId, strOrderId, strStatus, strNotes, strUpdatedBy, dtCreated
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            args: [
              `status_${Date.now()}_${Math.random()}`, strOrderId, strOrderStatus, `Order ${strOrderStatus}`, objCreator.strUserId, intOrderTimestamp
            ]
          });
        }
      }
    }

    console.log('✅ Test analytics data created successfully!');
    console.log('📊 You can now view analytics on the dashboard');

  } catch (error) {
    console.error('❌ Error creating test analytics data:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
fnCreateTestAnalyticsData(); 