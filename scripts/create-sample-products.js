import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const arrSampleProducts = [
  {
    strProductId: 'product_software_license',
    strProductName: 'Enterprise Software License',
    strProductCode: 'PROD_SW_001',
    strDescription: 'Full enterprise software license with 1 year support',
    strCategory: 'Software',
    decBasePrice: 999.99,
    decPartnerPrice: 899.99,
    intStockQuantity: 1000,
    bIsActive: true,
  },
  {
    strProductId: 'product_hardware_server',
    strProductName: 'High-Performance Server',
    strProductCode: 'PROD_HW_001',
    strDescription: 'Enterprise-grade server with latest specifications',
    strCategory: 'Hardware',
    decBasePrice: 2499.99,
    decPartnerPrice: 2249.99,
    intStockQuantity: 50,
    bIsActive: true,
  },
  {
    strProductId: 'product_consulting_hours',
    strProductName: 'Technical Consulting',
    strProductCode: 'PROD_CON_001',
    strDescription: 'Professional technical consulting services per hour',
    strCategory: 'Consulting',
    decBasePrice: 150.00,
    decPartnerPrice: 135.00,
    intStockQuantity: null,
    bIsActive: true,
  },
  {
    strProductId: 'product_support_plan',
    strProductName: '24/7 Support Plan',
    strProductCode: 'PROD_SUP_001',
    strDescription: 'Round-the-clock technical support and maintenance',
    strCategory: 'Support',
    decBasePrice: 299.99,
    decPartnerPrice: 269.99,
    intStockQuantity: null,
    bIsActive: true,
  },
  {
    strProductId: 'product_cloud_storage',
    strProductName: 'Cloud Storage Solution',
    strProductCode: 'PROD_CLOUD_001',
    strDescription: 'Secure cloud storage with 1TB capacity',
    strCategory: 'Services',
    decBasePrice: 79.99,
    decPartnerPrice: 71.99,
    intStockQuantity: null,
    bIsActive: true,
  },
];

async function fnCreateSampleProducts() {
  try {
    console.log('🚀 Creating sample products...');
    console.log('=====================================');

    for (const objProduct of arrSampleProducts) {
      console.log(`\n📦 Creating product: ${objProduct.strProductName}`);
      
      const objResult = await client.execute({
        sql: `
          INSERT INTO tblProducts (
            strProductId, strProductName, strProductCode, strDescription, 
            strCategory, decBasePrice, decPartnerPrice, intStockQuantity, 
            bIsActive, dtCreated
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          objProduct.strProductId,
          objProduct.strProductName,
          objProduct.strProductCode,
          objProduct.strDescription,
          objProduct.strCategory,
          objProduct.decBasePrice,
          objProduct.decPartnerPrice,
          objProduct.intStockQuantity,
          objProduct.bIsActive ? 1 : 0,
          new Date().toISOString(),
        ],
      });

      console.log(`   ✅ Created: ${objProduct.strProductName} - $${objProduct.decBasePrice}`);
    }

    console.log('\n🎉 All sample products created successfully!');
    console.log('\n📊 Sample Products Summary:');
    console.log('============================');
    
    for (const objProduct of arrSampleProducts) {
      console.log(`   • ${objProduct.strProductName} (${objProduct.strCategory}) - $${objProduct.decBasePrice}`);
    }

  } catch (error) {
    console.error('❌ Error creating sample products:', error);
  } finally {
    process.exit(0);
  }
}

fnCreateSampleProducts(); 