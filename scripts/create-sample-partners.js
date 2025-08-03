const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function fnCreateSamplePartners() {
  try {
    console.log('🔄 Creating sample partners...');

    // Sample partners data
    const arrSamplePartners = [
      {
        strPartnerId: 'partner_acme_corp',
        strPartnerName: 'ACME Corporation',
        strPartnerCode: 'ACME001',
        strContactEmail: 'partners@acme.com',
        strContactPhone: '+1-555-0101',
        strAddress: '123 Business Ave',
        strCity: 'New York',
        strState: 'NY',
        strCountry: 'USA',
        strPostalCode: '10001',
        decDiscountRate: 15.0,
        dtCreated: new Date(),
        dtUpdated: new Date(),
        bIsActive: 1,
      },
      {
        strPartnerId: 'partner_tech_solutions',
        strPartnerName: 'Tech Solutions Inc',
        strPartnerCode: 'TECH002',
        strContactEmail: 'sales@techsolutions.com',
        strContactPhone: '+1-555-0202',
        strAddress: '456 Innovation Drive',
        strCity: 'San Francisco',
        strState: 'CA',
        strCountry: 'USA',
        strPostalCode: '94105',
        decDiscountRate: 20.0,
        dtCreated: new Date(),
        dtUpdated: new Date(),
        bIsActive: 1,
      },
      {
        strPartnerId: 'partner_global_tech',
        strPartnerName: 'Global Tech Partners',
        strPartnerCode: 'GLOBAL003',
        strContactEmail: 'partners@globaltech.com',
        strContactPhone: '+1-555-0303',
        strAddress: '789 Enterprise Blvd',
        strCity: 'Austin',
        strState: 'TX',
        strCountry: 'USA',
        strPostalCode: '73301',
        decDiscountRate: 10.0,
        dtCreated: new Date(),
        dtUpdated: new Date(),
        bIsActive: 1,
      },
    ];

    // Insert partners
    for (const objPartner of arrSamplePartners) {
      const strInsertPartnerQuery = `
        INSERT OR REPLACE INTO tblPartners (
          strPartnerId, strPartnerName, strPartnerCode, strContactEmail, 
          strContactPhone, strAddress, strCity, strState, strCountry, 
          strPostalCode, decDiscountRate, dtCreated, dtUpdated, bIsActive
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await client.execute({
        sql: strInsertPartnerQuery,
        args: [
          objPartner.strPartnerId,
          objPartner.strPartnerName,
          objPartner.strPartnerCode,
          objPartner.strContactEmail,
          objPartner.strContactPhone,
          objPartner.strAddress,
          objPartner.strCity,
          objPartner.strState,
          objPartner.strCountry,
          objPartner.strPostalCode,
          objPartner.decDiscountRate,
          objPartner.dtCreated.getTime(),
          objPartner.dtUpdated.getTime(),
          objPartner.bIsActive,
        ],
      });

      console.log(`✅ Created partner: ${objPartner.strPartnerName}`);
    }

    console.log('✅ Sample partners created successfully!');

    // Now associate existing users with partners
    console.log('🔄 Associating users with partners...');

    // Get existing users
    const objUsersResult = await client.execute({
      sql: 'SELECT strUserId, strRole FROM tblUsers WHERE bIsActive = 1',
    });

    const arrUsers = objUsersResult.rows;
    console.log(`Found ${arrUsers.length} active users`);

    // Associate users with partners based on their role
    const arrPartnerAssociations = [
      // Partner admin users
      { strUserId: 'user_1754135651972_ubs3losvv', strPartnerId: 'partner_acme_corp', strRole: 'partner_admin' },
      
      // Partner users
      { strUserId: 'user_1754135652302_rni232413', strPartnerId: 'partner_acme_corp', strRole: 'partner_user' },
    ];

    for (const objAssociation of arrPartnerAssociations) {
      const strInsertAssociationQuery = `
        INSERT OR REPLACE INTO tblPartnerUsers (
          strPartnerUserId, strUserId, strPartnerId, strRole, dtCreated, dtUpdated, bIsActive
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const strPartnerUserId = `partner_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const dtNow = new Date();

      await client.execute({
        sql: strInsertAssociationQuery,
        args: [
          strPartnerUserId,
          objAssociation.strUserId,
          objAssociation.strPartnerId,
          objAssociation.strRole,
          dtNow.getTime(),
          dtNow.getTime(),
          1,
        ],
      });

      console.log(`✅ Associated user ${objAssociation.strUserId} with partner ${objAssociation.strPartnerId}`);
    }

    console.log('✅ User-partner associations created successfully!');

    // Display summary
    console.log('\n📊 Partner Setup Summary:');
    console.log('========================');
    
    const objPartnersResult = await client.execute({
      sql: 'SELECT strPartnerName, strPartnerCode, decDiscountRate FROM tblPartners WHERE bIsActive = 1',
    });
    
    console.log('Partners created:');
    objPartnersResult.rows.forEach(row => {
      console.log(`  - ${row.strPartnerName} (${row.strPartnerCode}) - ${row.decDiscountRate}% discount`);
    });

    const objAssociationsResult = await client.execute({
      sql: `
        SELECT pu.strRole, p.strPartnerName, COUNT(*) as userCount 
        FROM tblPartnerUsers pu 
        JOIN tblPartners p ON pu.strPartnerId = p.strPartnerId 
        WHERE pu.bIsActive = 1 
        GROUP BY pu.strRole, p.strPartnerName
      `,
    });

    console.log('\nUser associations:');
    objAssociationsResult.rows.forEach(row => {
      console.log(`  - ${row.strPartnerName}: ${row.userCount} ${row.strRole} users`);
    });

  } catch (error) {
    console.error('❌ Error creating sample partners:', error);
    process.exit(1);
  }
}

fnCreateSamplePartners(); 