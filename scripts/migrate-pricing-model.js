import { createClient } from '@libsql/client';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

// Create database client
const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function migratePricingModel() {
  console.log('Starting pricing model migration...');
  console.log('Database URL:', process.env.TURSO_DATABASE_URL ? 'Set' : 'Not set');
  console.log('Auth Token:', process.env.TURSO_AUTH_TOKEN ? 'Set' : 'Not set');

  try {
    // Step 1: Create the new tblPartnerPrices table
    console.log('Creating tblPartnerPrices table...');
    await client.execute(`
      CREATE TABLE IF NOT EXISTS tblPartnerPrices (
        strPartnerPriceId TEXT PRIMARY KEY,
        strPartnerId TEXT NOT NULL,
        strProductId TEXT NOT NULL,
        decPartnerPrice REAL NOT NULL,
        dtCreated INTEGER,
        dtUpdated INTEGER,
        bIsActive INTEGER
      )
    `);

    // Step 2: Migrate existing partner pricing data
    console.log('Migrating existing partner pricing data...');
    
    // Get all partners and products
    const partnersResult = await client.execute('SELECT * FROM tblPartners WHERE bIsActive = 1');
    const productsResult = await client.execute('SELECT * FROM tblProducts WHERE bIsActive = 1');
    
    const partners = partnersResult.rows;
    const products = productsResult.rows;
    
    console.log(`Found ${partners.length} partners and ${products.length} products`);

    // For each partner, create partner prices based on their discount rate
    for (const partner of partners) {
      if (partner.decDiscountRate && partner.decDiscountRate > 0) {
        console.log(`Processing partner: ${partner.strPartnerName} (${partner.decDiscountRate}% discount)`);
        
        for (const product of products) {
          // Calculate partner price based on discount rate
          const partnerPrice = product.decPartnerPrice || (product.decBasePrice * (1 - partner.decDiscountRate / 100));
          
          // Generate unique ID for partner price
          const partnerPriceId = `partner_price_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Insert partner price record
          await client.execute({
            sql: `INSERT INTO tblPartnerPrices (
              strPartnerPriceId, strPartnerId, strProductId, decPartnerPrice, 
              dtCreated, dtUpdated, bIsActive
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            args: [
              partnerPriceId,
              partner.strPartnerId,
              product.strProductId,
              partnerPrice,
              Date.now(),
              Date.now(),
              1
            ]
          });
        }
      }
    }

    // Step 3: Remove old columns (we'll do this carefully)
    console.log('Removing old pricing columns...');
    
    // Remove decPartnerPrice from tblProducts
    try {
      await client.execute('ALTER TABLE tblProducts DROP COLUMN decPartnerPrice');
      console.log('Removed decPartnerPrice from tblProducts');
    } catch (error) {
      console.log('decPartnerPrice column already removed or doesn\'t exist');
    }
    
    // Remove decDiscountRate from tblPartners
    try {
      await client.execute('ALTER TABLE tblPartners DROP COLUMN decDiscountRate');
      console.log('Removed decDiscountRate from tblPartners');
    } catch (error) {
      console.log('decDiscountRate column already removed or doesn\'t exist');
    }

    console.log('Pricing model migration completed successfully!');
    
    // Show summary
    const partnerPricesResult = await client.execute('SELECT COUNT(*) as count FROM tblPartnerPrices');
    console.log(`Created ${partnerPricesResult.rows[0].count} partner price records`);

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run the migration
migratePricingModel()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  }); 