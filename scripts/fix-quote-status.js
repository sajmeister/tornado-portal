import { db } from '../src/lib/db/index.ts';
import { tblQuotes } from '../src/lib/db/schema.ts';
import { eq } from 'drizzle-orm';

async function fixQuoteStatus() {
  try {
    console.log('🔧 Fixing quote statuses...\n');
    
    // Get all quotes
    const quotes = await db.select().from(tblQuotes);
    
    console.log(`📊 Found ${quotes.length} quotes to check:\n`);
    
    for (const quote of quotes) {
      console.log(`Quote: ${quote.strQuoteNumber}`);
      console.log(`  Current status: ${quote.strStatus || 'NULL'}`);
      
      // If status is null or empty, set it to 'draft'
      if (!quote.strStatus || quote.strStatus.trim() === '') {
        console.log(`  ⚠️  Status is empty, setting to 'draft'...`);
        
        await db.update(tblQuotes)
          .set({ 
            strStatus: 'draft',
            dtUpdated: new Date()
          })
          .where(eq(tblQuotes.strQuoteId, quote.strQuoteId));
        
        console.log(`  ✅ Updated status to 'draft'`);
      } else {
        console.log(`  ✅ Status is already set: '${quote.strStatus}'`);
      }
      console.log('');
    }
    
    console.log('🎉 Quote status fix completed!');
    
  } catch (error) {
    console.error('❌ Error fixing quote statuses:', error);
  }
}

fixQuoteStatus(); 