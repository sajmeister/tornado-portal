const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function fnShowUsers() {
  try {
    console.log('🔍 Showing users in database...');

    const objUsersResult = await client.execute({
      sql: 'SELECT strUserId, strUsername, strEmail, strName, strRole FROM tblUsers WHERE bIsActive = 1',
    });

    console.log(`Found ${objUsersResult.rows.length} active users:`);
    console.log('');

    objUsersResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. User ID: ${row.strUserId}`);
      console.log(`   Username: ${row.strUsername}`);
      console.log(`   Email: ${row.strEmail}`);
      console.log(`   Name: ${row.strName}`);
      console.log(`   Role: ${row.strRole}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error showing users:', error);
    process.exit(1);
  }
}

fnShowUsers(); 