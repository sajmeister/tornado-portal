import { db } from '../src/lib/db/index.ts';
import { tblQuotes } from '../src/lib/db/schema.ts';

async function checkQuotes() {
  try {
    console.log('🔍 Checking quotes in database...\n');
    
    const quotes = await db.select().from(tblQuotes);
    
    console.log(`📊 Found ${quotes.length} quotes:\n`);
    
    quotes.forEach((quote, index) => {
      console.log(`Quote ${index + 1}:`);
      console.log(`  ID: ${quote.strQuoteId}`);
      console.log(`  Number: ${quote.strQuoteNumber}`);
      console.log(`  Status: ${quote.strStatus || 'NULL'}`);
      console.log(`  Partner ID: ${quote.strPartnerId}`);
      console.log(`  Created By: ${quote.strCreatedBy}`);
      console.log(`  Subtotal: $${quote.decSubtotal}`);
      console.log(`  Total: $${quote.decTotal}`);
      console.log(`  Active: ${quote.bIsActive}`);
      console.log(`  Created: ${quote.dtCreated ? new Date(quote.dtCreated).toLocaleString() : 'NULL'}`);
      console.log(`  Updated: ${quote.dtUpdated ? new Date(quote.dtUpdated).toLocaleString() : 'NULL'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error checking quotes:', error);
  }
}

checkQuotes(); 