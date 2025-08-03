import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Users table
export const tblUsers = sqliteTable('tblUsers', {
  strUserId: text('strUserId').primaryKey(),
  strEmail: text('strEmail').notNull(),
  strName: text('strName').notNull(),
  strAvatarUrl: text('strAvatarUrl'),
  strProvider: text('strProvider').notNull(),
  strProviderId: text('strProviderId').notNull(),
  dtCreated: integer('dtCreated', { mode: 'timestamp' }),
  dtUpdated: integer('dtUpdated', { mode: 'timestamp' }),
  bIsActive: integer('bIsActive', { mode: 'boolean' }),
  strPasswordHash: text('strPasswordHash'),
  strRole: text('strRole'),
  dtLastLogin: integer('dtLastLogin', { mode: 'timestamp' }),
  strUsername: text('strUsername'),
});

// Partners table
export const tblPartners = sqliteTable('tblPartners', {
  strPartnerId: text('strPartnerId').primaryKey(),
  strPartnerName: text('strPartnerName').notNull(),
  strPartnerCode: text('strPartnerCode').notNull(),
  strContactEmail: text('strContactEmail').notNull(),
  strContactPhone: text('strContactPhone'),
  strAddress: text('strAddress'),
  strCity: text('strCity'),
  strState: text('strState'),
  strCountry: text('strCountry'),
  strPostalCode: text('strPostalCode'),
  dtCreated: integer('dtCreated', { mode: 'timestamp' }),
  dtUpdated: integer('dtUpdated', { mode: 'timestamp' }),
  bIsActive: integer('bIsActive', { mode: 'boolean' }),
});

// Products table
export const tblProducts = sqliteTable('tblProducts', {
  strProductId: text('strProductId').primaryKey(),
  strProductName: text('strProductName').notNull(),
  strProductCode: text('strProductCode').notNull(),
  strDescription: text('strDescription'),
  strCategory: text('strCategory').notNull(),
  decBasePrice: real('decBasePrice').notNull(),
  intStockQuantity: integer('intStockQuantity'),
  strImageUrl: text('strImageUrl'),
  strDependencyId: text('strDependencyId'), // Product ID that this product depends on (for add-ons)
  dtCreated: integer('dtCreated', { mode: 'timestamp' }),
  dtUpdated: integer('dtUpdated', { mode: 'timestamp' }),
  bIsActive: integer('bIsActive', { mode: 'boolean' }),
});

// Partner Prices table - for partner-specific pricing
export const tblPartnerPrices = sqliteTable('tblPartnerPrices', {
  strPartnerPriceId: text('strPartnerPriceId').primaryKey(),
  strPartnerId: text('strPartnerId').notNull(),
  strProductId: text('strProductId').notNull(),
  decPartnerPrice: real('decPartnerPrice').notNull(),
  dtCreated: integer('dtCreated', { mode: 'timestamp' }),
  dtUpdated: integer('dtUpdated', { mode: 'timestamp' }),
  bIsActive: integer('bIsActive', { mode: 'boolean' }),
});

// Quotes table
export const tblQuotes = sqliteTable('tblQuotes', {
  strQuoteId: text('strQuoteId').primaryKey(),
  strQuoteNumber: text('strQuoteNumber').notNull(),
  strPartnerId: text('strPartnerId').notNull(),
  strCreatedBy: text('strCreatedBy').notNull(),
  strStatus: text('strStatus').notNull(),
  decSubtotal: real('decSubtotal').notNull(), // Partner price subtotal (what provider gets paid)
  decCustomerSubtotal: real('decCustomerSubtotal').notNull(), // Customer price subtotal (what partner charges customer)
  decDiscountAmount: real('decDiscountAmount').notNull(),
  decTotal: real('decTotal').notNull(), // Customer total (what customer pays)
  decPartnerTotal: real('decPartnerTotal').notNull(), // Partner total (what provider gets paid)
  strNotes: text('strNotes'),
  dtValidUntil: integer('dtValidUntil', { mode: 'timestamp' }),
  dtCreated: integer('dtCreated', { mode: 'timestamp' }),
  dtUpdated: integer('dtUpdated', { mode: 'timestamp' }),
  bIsActive: integer('bIsActive', { mode: 'boolean' }),
});

// Quote items table
export const tblQuoteItems = sqliteTable('tblQuoteItems', {
  strQuoteItemId: text('strQuoteItemId').primaryKey(),
  strQuoteId: text('strQuoteId').notNull(),
  strProductId: text('strProductId').notNull(),
  intQuantity: integer('intQuantity').notNull(),
  decUnitPrice: real('decUnitPrice').notNull(), // Partner unit price (what provider gets paid)
  decCustomerUnitPrice: real('decCustomerUnitPrice').notNull(), // Customer unit price (what partner charges customer)
  decLineTotal: real('decLineTotal').notNull(), // Partner line total (what provider gets paid)
  decCustomerLineTotal: real('decCustomerLineTotal').notNull(), // Customer line total (what partner charges customer)
  strNotes: text('strNotes'),
  dtCreated: integer('dtCreated', { mode: 'timestamp' }),
  bIsActive: integer('bIsActive', { mode: 'boolean' }),
});

// Orders table
export const tblOrders = sqliteTable('tblOrders', {
  strOrderId: text('strOrderId').primaryKey(),
  strOrderNumber: text('strOrderNumber').notNull(),
  strQuoteId: text('strQuoteId'),
  strPartnerId: text('strPartnerId').notNull(),
  strCreatedBy: text('strCreatedBy').notNull(),
  strStatus: text('strStatus').notNull(),
  decSubtotal: real('decSubtotal').notNull(),
  decDiscountAmount: real('decDiscountAmount').notNull(),
  decTotal: real('decTotal').notNull(),
  strShippingAddress: text('strShippingAddress'),
  strBillingAddress: text('strBillingAddress'),
  strNotes: text('strNotes'),
  dtExpectedDelivery: integer('dtExpectedDelivery', { mode: 'timestamp' }),
  dtCreated: integer('dtCreated', { mode: 'timestamp' }),
  dtUpdated: integer('dtUpdated', { mode: 'timestamp' }),
  bIsActive: integer('bIsActive', { mode: 'boolean' }),
});

// Order items table
export const tblOrderItems = sqliteTable('tblOrderItems', {
  strOrderItemId: text('strOrderItemId').primaryKey(),
  strOrderId: text('strOrderId').notNull(),
  strProductId: text('strProductId').notNull(),
  intQuantity: integer('intQuantity').notNull(),
  decUnitPrice: real('decUnitPrice').notNull(),
  decLineTotal: real('decLineTotal').notNull(),
  strNotes: text('strNotes'),
  dtCreated: integer('dtCreated', { mode: 'timestamp' }),
  bIsActive: integer('bIsActive', { mode: 'boolean' }),
});

// Order status history table
export const tblOrderStatusHistory = sqliteTable('tblOrderStatusHistory', {
  strStatusHistoryId: text('strStatusHistoryId').primaryKey(),
  strOrderId: text('strOrderId').notNull(),
  strStatus: text('strStatus').notNull(),
  strNotes: text('strNotes'),
  strUpdatedBy: text('strUpdatedBy').notNull(),
  dtCreated: integer('dtCreated', { mode: 'timestamp' }),
});

// Partner users table
export const tblPartnerUsers = sqliteTable('tblPartnerUsers', {
  strPartnerUserId: text('strPartnerUserId').primaryKey(),
  strUserId: text('strUserId').notNull(),
  strPartnerId: text('strPartnerId').notNull(),
  strRole: text('strRole').notNull(),
  dtCreated: integer('dtCreated', { mode: 'timestamp' }),
  dtUpdated: integer('dtUpdated', { mode: 'timestamp' }),
  bIsActive: integer('bIsActive', { mode: 'boolean' }),
}); 