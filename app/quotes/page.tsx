'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fnHasPermission } from '../../src/lib/roles';
import { fnCanBypassPartnerIsolation } from '../../src/lib/partner-utils';
import CmpHeader from '../components/CmpHeader';

interface IProduct {
  strProductId: string;
  strProductName: string;
  strProductCode: string;
  strDescription: string;
  strCategory: string;
  decBasePrice: number;
  decPartnerPrice: number;
  intStockQuantity: number;
  bIsActive: boolean;
}

interface IQuoteItem {
  strQuoteItemId: string;
  strProductId: string;
  strProductName: string;
  strProductCode: string;
  intQuantity: number;
  decUnitPrice: number;
  decLineTotal: number;
  strNotes: string;
}

interface IQuote {
  strQuoteId: string;
  strQuoteNumber: string;
  strPartnerId: string;
  strCreatedBy: string;
  strStatus: string;
  decSubtotal: number;
  decDiscountAmount: number;
  decTotal: number;
  strNotes: string;
  dtValidUntil: string;
  dtCreated: string;
  dtUpdated: string;
  bIsActive: boolean;
  arrItems: IQuoteItem[];
}

interface IUser {
  strUserId: string;
  strUsername: string;
  strEmail: string;
  strName: string;
  strRole: string;
  strAvatarUrl?: string;
  bIsActive: boolean;
}

interface IPartner {
  strPartnerId: string;
  strPartnerName: string;
  strPartnerCode: string;
  strContactEmail: string;
  decDiscountRate: number | null;
  bIsActive: boolean;
}

export default function QuotesPage() {
  const [arrQuotes, setArrQuotes] = useState<IQuote[]>([]);
  const [arrProducts, setArrProducts] = useState<IProduct[]>([]);
  const [arrPartners, setArrPartners] = useState<IPartner[]>([]);
  const [objUser, setObjUser] = useState<IUser | null>(null);
  const [bIsLoading, setIsLoading] = useState(true);
  const [bIsCreating, setIsCreating] = useState(false);
  const [bShowCreateModal, setBShowCreateModal] = useState(false);
  const [strError, setStrError] = useState('');
  const router = useRouter();

  // Check if user has permission to manage quotes
  const fnCanManageQuotes = (strRole: string): boolean => {
    return ['super_admin', 'provider_user', 'partner_admin', 'partner_user'].includes(strRole);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    const fnLoadUserAndData = async () => {
      try {
        // Get current user
        const objUserResponse = await fetch('/api/auth/me');
        const objUserData = await objUserResponse.json();
        
        if (!objUserData.success) {
          router.push('/login');
          return;
        }

        const objCurrentUser = objUserData.user;
        setObjUser(objCurrentUser);

        // Check if user has permission
        if (!fnCanManageQuotes(objCurrentUser.strRole)) {
          setStrError('Access denied. You do not have permission to manage quotes.');
          setIsLoading(false);
          return;
        }

        // Load quotes and products
        const [objQuotesResponse, objProductsResponse] = await Promise.all([
          fetch('/api/quotes'),
          fetch('/api/products')
        ]);

        const objQuotesData = await objQuotesResponse.json();
        const objProductsData = await objProductsResponse.json();
        
        if (objQuotesData.success) {
          setArrQuotes(objQuotesData.quotes);
        } else {
          setStrError('Failed to load quotes');
        }

        if (objProductsData.success) {
          setArrProducts(objProductsData.products);
        }

        // Load partners (for Super Admin/Provider users)
        if (fnCanBypassPartnerIsolation(objCurrentUser.strRole)) {
          const objPartnersResponse = await fetch('/api/partners');
          const objPartnersData = await objPartnersResponse.json();
          if (objPartnersData.success) {
            setArrPartners(objPartnersData.partners);
          }
        }
      } catch (error) {
        setStrError('Error loading data');
      } finally {
        setIsLoading(false);
      }
    };

    fnLoadUserAndData();
  }, [router]);

  const fnCreateQuote = async (objQuoteData: {
    strNotes: string;
    dtValidUntil: string;
    strPartnerId?: string;
    arrItems: Array<{
      strProductId: string;
      intQuantity: number;
      decUnitPrice: number;
      strNotes: string;
    }>;
  }) => {
    try {
      setIsCreating(true);
      const objResponse = await fetch('/api/quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(objQuoteData),
      });

      const objData = await objResponse.json();
      
      if (objData.success) {
        // Reload quotes
        const objQuotesResponse = await fetch('/api/quotes');
        const objQuotesData = await objQuotesResponse.json();
        if (objQuotesData.success) {
          setArrQuotes(objQuotesData.quotes);
        }
        setBShowCreateModal(false);
      } else {
        setStrError(objData.error || 'Failed to create quote');
      }
    } catch (error) {
      setStrError('Error creating quote');
    } finally {
      setIsCreating(false);
    }
  };

  const fnGetStatusColor = (strStatus: string): string => {
    switch (strStatus.toLowerCase()) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const fnUpdateQuoteStatus = async (strQuoteId: string, strNewStatus: string, strNotes?: string) => {
    try {
      const objResponse = await fetch(`/api/quotes/${strQuoteId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ strStatus: strNewStatus, strNotes }),
      });

      const objData = await objResponse.json();
      
      if (objData.success) {
        // Reload quotes
        const objQuotesResponse = await fetch('/api/quotes');
        const objQuotesData = await objQuotesResponse.json();
        if (objQuotesData.success) {
          setArrQuotes(objQuotesData.quotes);
        }
      } else {
        setStrError(objData.message || 'Failed to update quote status');
      }
    } catch (error) {
      setStrError('Error updating quote status');
    }
  };

  if (bIsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-lg shadow p-6">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (strError) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h2>
            <p className="text-red-700">{strError}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CmpHeader objUser={objUser} onLogout={handleLogout} />
      
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Quotes</h1>
            <p className="text-gray-600 mt-2">
              {objUser && fnCanBypassPartnerIsolation(objUser.strRole) 
                ? "Manage and create quotes for your partners"
                : "View and manage your quotes"
              }
            </p>
          </div>
          <button
            onClick={() => setBShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Create Quote
          </button>
        </div>

        {/* Quotes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {arrQuotes.map((objQuote) => (
            <div key={objQuote.strQuoteId} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{objQuote.strQuoteNumber}</h3>
                  <p className="text-sm text-gray-500">Created {new Date(objQuote.dtCreated).toLocaleDateString()}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${fnGetStatusColor(objQuote.strStatus)}`}>
                  {objQuote.strStatus}
                </span>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">${objQuote.decSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount:</span>
                  <span className="font-medium">${objQuote.decDiscountAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t pt-2">
                  <span>Total:</span>
                  <span>${objQuote.decTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="text-sm text-gray-600 mb-4">
                <p><strong>Items:</strong> {objQuote.arrItems?.length || 0}</p>
                {objQuote.dtValidUntil && (
                  <p><strong>Valid until:</strong> {new Date(objQuote.dtValidUntil).toLocaleDateString()}</p>
                )}
              </div>

              <div className="flex space-x-2">
                <button className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm font-medium transition-colors">
                  View Details
                </button>
                {objQuote.strStatus === 'draft' && (
                  <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors">
                    Edit
                  </button>
                )}
                {/* Approval buttons - only for Super Admin and Provider User */}
                {objUser && fnHasPermission(objUser.strRole, 'quote:manage') && objQuote.strStatus === 'sent' && (
                  <>
                    <button 
                      onClick={() => fnUpdateQuoteStatus(objQuote.strQuoteId, 'approved', 'Quote approved')}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => fnUpdateQuoteStatus(objQuote.strQuoteId, 'rejected', 'Quote rejected')}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {arrQuotes.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No quotes yet</h3>
            <p className="text-gray-600 mb-6">Get started by creating your first quote</p>
            <button
              onClick={() => setBShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Create Quote
            </button>
          </div>
        )}
      </div>

      {/* Create Quote Modal */}
      {bShowCreateModal && (
        <CreateQuoteModal
          products={arrProducts}
          partners={arrPartners}
          objUser={objUser}
          onSubmit={fnCreateQuote}
          onClose={() => setBShowCreateModal(false)}
          isLoading={bIsCreating}
        />
      )}
    </div>
  );
}

// Create Quote Modal Component
function CreateQuoteModal({ 
  products, 
  partners,
  objUser,
  onSubmit, 
  onClose, 
  isLoading 
}: { 
  products: IProduct[];
  partners: IPartner[];
  objUser: IUser | null;
  onSubmit: (data: {
    strNotes: string;
    dtValidUntil: string;
    strPartnerId?: string;
    arrItems: Array<{
      strProductId: string;
      intQuantity: number;
      decUnitPrice: number;
      strNotes: string;
    }>;
  }) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const [strNotes, setStrNotes] = useState('');
  const [dtValidUntil, setDtValidUntil] = useState('');
  const [strPartnerId, setStrPartnerId] = useState('');
  const [arrItems, setArrItems] = useState<Array<{
    strProductId: string;
    intQuantity: number;
    decUnitPrice: number;
    strNotes: string;
  }>>([]);

  const fnAddItem = () => {
    setArrItems([...arrItems, {
      strProductId: '',
      intQuantity: 1,
      decUnitPrice: 0,
      strNotes: ''
    }]);
  };

  const fnRemoveItem = (intIndex: number) => {
    setArrItems(arrItems.filter((_, index) => index !== intIndex));
  };

  const fnUpdateItem = (intIndex: number, strField: string, value: string | number) => {
    const arrNewItems = [...arrItems];
    arrNewItems[intIndex] = { ...arrNewItems[intIndex], [strField]: value };
    
    // Auto-calculate unit price when product is selected
    if (strField === 'strProductId') {
      const objProduct = products.find(p => p.strProductId === value);
      if (objProduct) {
        arrNewItems[intIndex].decUnitPrice = objProduct.decPartnerPrice;
      }
    }
    
    setArrItems(arrNewItems);
  };

  const fnHandleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate items
    if (arrItems.length === 0) {
      alert('Please add at least one item to the quote');
      return;
    }

    const arrValidItems = arrItems.filter(item => 
      item.strProductId && item.intQuantity > 0 && item.decUnitPrice > 0
    );

    if (arrValidItems.length === 0) {
      alert('Please fill in all required fields for quote items');
      return;
    }

    onSubmit({
      strNotes,
      dtValidUntil,
      strPartnerId: strPartnerId || undefined,
      arrItems: arrValidItems
    });
  };

  const fnCalculateTotal = (): number => {
    return arrItems.reduce((total, item) => {
      return total + (item.intQuantity * item.decUnitPrice);
    }, 0);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create New Quote</h2>
        </div>

        <form onSubmit={fnHandleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valid Until
              </label>
              <input
                type="date"
                value={dtValidUntil}
                onChange={(e) => setDtValidUntil(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            {/* Partner selection for Super Admin/Provider users */}
            {objUser && fnCanBypassPartnerIsolation(objUser.strRole) && partners.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Partner
                </label>
                <select
                  value={strPartnerId}
                  onChange={(e) => setStrPartnerId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a partner (optional)</option>
                  {partners.map((partner) => (
                    <option key={partner.strPartnerId} value={partner.strPartnerId}>
                      {partner.strPartnerName} ({partner.strPartnerCode})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={strNotes}
              onChange={(e) => setStrNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add any notes or special instructions..."
            />
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Quote Items</h3>
              <button
                type="button"
                onClick={fnAddItem}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                Add Item
              </button>
            </div>

            {arrItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                                             <p>No items added yet. Click &quot;Add Item&quot; to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {arrItems.map((item, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Product
                        </label>
                        <select
                          value={item.strProductId}
                          onChange={(e) => fnUpdateItem(index, 'strProductId', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Select a product</option>
                          {products.map((product) => (
                            <option key={product.strProductId} value={product.strProductId}>
                              {product.strProductName} - ${product.decPartnerPrice}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={item.intQuantity}
                          onChange={(e) => fnUpdateItem(index, 'intQuantity', parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Unit Price
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.decUnitPrice}
                          onChange={(e) => fnUpdateItem(index, 'decUnitPrice', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>

                      <div className="flex items-end space-x-2">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Line Total
                          </label>
                          <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm font-medium">
                            ${(item.intQuantity * item.decUnitPrice).toFixed(2)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => fnRemoveItem(index)}
                          className="text-red-600 hover:text-red-800 p-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes
                      </label>
                      <input
                        type="text"
                        value={item.strNotes}
                        onChange={(e) => fnUpdateItem(index, 'strNotes', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Optional notes for this item..."
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {arrItems.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">
                  Total: ${fnCalculateTotal().toFixed(2)}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || arrItems.length === 0}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating...' : 'Create Quote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 