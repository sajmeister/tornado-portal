const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env.local' });

async function setupDatabase() {
  console.log('🔧 Setting up database...');
  
  if (!process.env.TURSO_DATABASE_URL) {
    console.error('❌ TURSO_DATABASE_URL is not set in .env.local');
    console.log('📝 Please create a .env.local file with your database configuration');
    return;
  }

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    console.log('📊 Creating tables...');

    // Create users table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS tblUsers (
        strUserId TEXT PRIMARY KEY,
        strUsername TEXT UNIQUE NOT NULL,
        strEmail TEXT UNIQUE NOT NULL,
        strName TEXT NOT NULL,
        strPasswordHash TEXT NOT NULL,
        strRole TEXT NOT NULL,
        strAvatarUrl TEXT,
        strProvider TEXT NOT NULL,
        strProviderId TEXT NOT NULL,
        dtCreated INTEGER,
        dtUpdated INTEGER,
        bIsActive INTEGER DEFAULT 1
      )
    `);
    console.log('✅ Users table created');

    // Create partners table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS tblPartners (
        strPartnerId TEXT PRIMARY KEY,
        strPartnerName TEXT NOT NULL,
        strContactEmail TEXT,
        strContactPhone TEXT,
        strAddress TEXT,
        decDiscountRate REAL,
        dtCreated INTEGER,
        dtUpdated INTEGER,
        bIsActive INTEGER DEFAULT 1
      )
    `);
    console.log('✅ Partners table created');

    // Create partner customers table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS tblPartnerUsers (
        strPartnerUserId TEXT PRIMARY KEY,
        strUserId TEXT NOT NULL,
        strPartnerId TEXT NOT NULL,
        strRole TEXT NOT NULL,
        dtCreated INTEGER,
        dtUpdated INTEGER,
        bIsActive INTEGER DEFAULT 1
      )
    `);
    console.log('✅ Partner Customers table created');

    // Create products table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS tblProducts (
        strProductId TEXT PRIMARY KEY,
        strProductName TEXT NOT NULL,
        strProductCode TEXT NOT NULL,
        strDescription TEXT,
        strCategory TEXT NOT NULL,
        decBasePrice REAL NOT NULL,
        decPartnerPrice REAL NOT NULL,
        intStockQuantity INTEGER,
        strImageUrl TEXT,
        strDependencyId TEXT,
        dtCreated INTEGER,
        dtUpdated INTEGER,
        bIsActive INTEGER DEFAULT 1
      )
    `);
    console.log('✅ Products table created');

    // Create quotes table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS tblQuotes (
        strQuoteId TEXT PRIMARY KEY,
        strQuoteNumber TEXT NOT NULL,
        strPartnerId TEXT NOT NULL,
        strCreatedBy TEXT NOT NULL,
        strStatus TEXT NOT NULL,
        decSubtotal REAL NOT NULL,
        decDiscountAmount REAL NOT NULL,
        decTotal REAL NOT NULL,
        strNotes TEXT,
        dtValidUntil INTEGER,
        dtCreated INTEGER,
        dtUpdated INTEGER,
        bIsActive INTEGER DEFAULT 1
      )
    `);
    console.log('✅ Quotes table created');

    // Create quote items table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS tblQuoteItems (
        strQuoteItemId TEXT PRIMARY KEY,
        strQuoteId TEXT NOT NULL,
        strProductId TEXT NOT NULL,
        intQuantity INTEGER NOT NULL,
        decUnitPrice REAL NOT NULL,
        decLineTotal REAL NOT NULL,
        strNotes TEXT,
        dtCreated INTEGER,
        bIsActive INTEGER DEFAULT 1
      )
    `);
    console.log('✅ Quote Items table created');

    // Create orders table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS tblOrders (
        strOrderId TEXT PRIMARY KEY,
        strOrderNumber TEXT NOT NULL,
        strQuoteId TEXT,
        strPartnerId TEXT NOT NULL,
        strCreatedBy TEXT NOT NULL,
        strStatus TEXT NOT NULL,
        decSubtotal REAL NOT NULL,
        decDiscountAmount REAL NOT NULL,
        decTotal REAL NOT NULL,
        strShippingAddress TEXT,
        strBillingAddress TEXT,
        strNotes TEXT,
        dtExpectedDelivery INTEGER,
        dtCreated INTEGER,
        dtUpdated INTEGER,
        bIsActive INTEGER DEFAULT 1
      )
    `);
    console.log('✅ Orders table created');

    // Create order items table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS tblOrderItems (
        strOrderItemId TEXT PRIMARY KEY,
        strOrderId TEXT NOT NULL,
        strProductId TEXT NOT NULL,
        intQuantity INTEGER NOT NULL,
        decUnitPrice REAL NOT NULL,
        decLineTotal REAL NOT NULL,
        strNotes TEXT,
        dtCreated INTEGER,
        bIsActive INTEGER DEFAULT 1
      )
    `);
    console.log('✅ Order Items table created');

    // Create order status history table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS tblOrderStatusHistory (
        strStatusHistoryId TEXT PRIMARY KEY,
        strOrderId TEXT NOT NULL,
        strStatus TEXT NOT NULL,
        strNotes TEXT,
        strUpdatedBy TEXT NOT NULL,
        dtCreated INTEGER
      )
    `);
    console.log('✅ Order Status History table created');

    console.log('\n🎉 Database setup completed successfully!');
    
    // Check table counts
    const tables = ['tblUsers', 'tblPartners', 'tblPartnerUsers', 'tblProducts', 'tblQuotes', 'tblQuoteItems', 'tblOrders', 'tblOrderItems', 'tblOrderStatusHistory'];
    
    for (const table of tables) {
      try {
        const result = await client.execute(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`📊 ${table}: ${result.rows[0].count} rows`);
      } catch (error) {
        console.log(`❌ ${table}: Error checking count`);
      }
    }

  } catch (error) {
    console.error('❌ Error setting up database:', error);
    console.error('Error details:', error.message);
  }
}

setupDatabase(); 