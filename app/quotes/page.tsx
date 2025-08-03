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
  decDisplayPrice?: number; // New field from API
  decPartnerPrice?: number; // Optional for backward compatibility
  intStockQuantity: number;
  bIsActive: boolean;
}

interface IQuoteItem {
  strQuoteItemId: string;
  strProductId: string;
  strProductName: string;
  strProductCode: string;
  intQuantity: number;
  decUnitPrice: number; // Partner unit price (what provider gets paid)
  decCustomerUnitPrice: number; // Customer unit price (what partner charges customer)
  decLineTotal: number; // Partner line total (what provider gets paid)
  decCustomerLineTotal: number; // Customer line total (what partner charges customer)
  strNotes: string;
}

interface IQuote {
  strQuoteId: string;
  strQuoteNumber: string;
  strPartnerId: string;
  strCreatedBy: string;
  strStatus: string;
  decSubtotal: number; // Partner subtotal (what provider gets paid)
  decCustomerSubtotal: number; // Customer subtotal (what partner charges customer)
  decDiscountAmount: number;
  decTotal: number; // Customer total (what customer pays)
  decPartnerTotal: number; // Partner total (what provider gets paid)
  strNotes: string;
  dtValidUntil: string;
  dtCreated: string;
  dtUpdated: string;
  bIsActive: boolean;
  arrItems: IQuoteItem[];
  objPartner?: {
    strPartnerName: string;
    strPartnerCode: string;
  };
  bHasOrder?: boolean;
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
  const [bShowQuoteDetailsModal, setBShowQuoteDetailsModal] = useState(false);
  const [objSelectedQuote, setObjSelectedQuote] = useState<IQuote | null>(null);
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
          console.log('📊 Quotes loaded:', objQuotesData.quotes);
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
      decUnitPrice: number; // Partner price (what provider gets paid)
      decCustomerUnitPrice: number; // Customer price (what partner charges customer)
      strNotes: string;
    }>;
  }) => {
    try {
      setIsCreating(true);
      
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(objQuoteData),
      });

      const data = await response.json();
      
      if (data.success) {
        // Reload quotes to show the new quote
        const objQuotesResponse = await fetch('/api/quotes');
        const objQuotesData = await objQuotesResponse.json();
        if (objQuotesData.success) {
          setArrQuotes(objQuotesData.quotes);
        }
        setIsCreating(false);
        setBShowCreateModal(false);
      } else {
        alert('Error creating quote: ' + data.error);
        setIsCreating(false);
      }
    } catch (error) {
      console.error('Error creating quote:', error);
      alert('Error creating quote');
      setIsCreating(false);
    }
  };

  const fnGetStatusDisplayName = (strStatus: string, objUser?: IUser | null): string => {
    if (!strStatus) return 'No Status';
    
    // For Partner users, don't show "sent" status - show it as "pending"
    const strDisplayStatus = (objUser && !fnCanBypassPartnerIsolation(objUser.strRole) && strStatus.toLowerCase() === 'sent') 
      ? 'pending' 
      : strStatus.toLowerCase();
    
    const objStatusMap: { [key: string]: string } = {
      'draft': 'Draft',
      'sent': 'Sent',
      'pending': 'Pending Review',
      'approved': 'Approved',
      'rejected': 'Rejected',
      'expired': 'Expired'
    };
    return objStatusMap[strDisplayStatus] || strStatus;
  };

  const fnGetStatusColor = (strStatus: string, objUser?: IUser | null): string => {
    if (!strStatus) return 'bg-gray-200 text-gray-900 border border-gray-300';
    
    // For Partner users, don't show "sent" status - show it as "pending"
    const strDisplayStatus = (objUser && !fnCanBypassPartnerIsolation(objUser.strRole) && strStatus.toLowerCase() === 'sent') 
      ? 'pending' 
      : strStatus.toLowerCase();
    
    switch (strDisplayStatus) {
      case 'draft': return 'bg-gray-200 text-gray-900 border border-gray-400';
      case 'sent': return 'bg-blue-200 text-blue-900 border border-blue-400';
      case 'pending': return 'bg-orange-200 text-orange-900 border border-orange-400';
      case 'approved': return 'bg-green-200 text-green-900 border border-green-400';
      case 'rejected': return 'bg-red-200 text-red-900 border border-red-400';
      case 'expired': return 'bg-yellow-200 text-yellow-900 border border-yellow-400';
      default: return 'bg-gray-200 text-gray-900 border border-gray-300';
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

  const fnDeleteQuote = async (strQuoteId: string) => {
    if (!confirm('Are you sure you want to delete this quote? This action cannot be undone.')) {
      return;
    }

    try {
      const objResponse = await fetch(`/api/quotes/${strQuoteId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
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
        setStrError(objData.message || 'Failed to delete quote');
      }
    } catch (error) {
      setStrError('Error deleting quote');
    }
  };

  const fnConvertQuoteToOrder = async (strQuoteId: string) => {
    if (!confirm('Are you sure you want to convert this quote to an order? This action cannot be undone.')) {
      return;
    }

    try {
      const objResponse = await fetch(`/api/orders/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ strQuoteId }),
      });

      const objData = await objResponse.json();
      
      if (objData.success) {
        // Reload quotes
        const objQuotesResponse = await fetch('/api/quotes');
        const objQuotesData = await objQuotesResponse.json();
        if (objQuotesData.success) {
          setArrQuotes(objQuotesData.quotes);
        }
        // Show success message or redirect to orders
        alert('Quote successfully converted to order!');
      } else {
        setStrError(objData.message || 'Failed to convert quote to order');
      }
    } catch (error) {
      setStrError('Error converting quote to order');
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
                                  {objUser && fnCanBypassPartnerIsolation(objUser.strRole) && objQuote.objPartner && (
                 <p className="text-sm text-blue-600 font-medium mt-1">
                   {objQuote.objPartner.strPartnerName}
                 </p>
               )}
                 </div>
                 <div className="text-right">
                   <div className="text-xs text-gray-500 mb-1">Status</div>
                                       <div className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold uppercase tracking-wide ${fnGetStatusColor(objQuote.strStatus, objUser)}`}>
                      {fnGetStatusDisplayName(objQuote.strStatus, objUser) === 'Draft' && (
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      )}
                      {fnGetStatusDisplayName(objQuote.strStatus, objUser) === 'Sent' && (
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                        </svg>
                      )}
                      {fnGetStatusDisplayName(objQuote.strStatus, objUser) === 'Pending Review' && (
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      )}
                      {fnGetStatusDisplayName(objQuote.strStatus, objUser) === 'Approved' && (
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      {fnGetStatusDisplayName(objQuote.strStatus, objUser) === 'Rejected' && (
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      )}
                      {fnGetStatusDisplayName(objQuote.strStatus, objUser) === 'Expired' && (
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                      )}
                      {fnGetStatusDisplayName(objQuote.strStatus, objUser)}
                    </div>
                 </div>
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
                <button 
                  onClick={() => {
                    setObjSelectedQuote(objQuote);
                    setBShowQuoteDetailsModal(true);
                  }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm font-medium transition-colors"
                >
                  View Details
                </button>
                {objQuote.strStatus === 'draft' && (
                  <>
                    <button 
                      onClick={() => {
                        setObjSelectedQuote(objQuote);
                        setBShowQuoteDetailsModal(true);
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => fnUpdateQuoteStatus(objQuote.strQuoteId, 'sent', 'Quote sent to customer')}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                    >
                      Send Quote
                    </button>
                    <button 
                      onClick={() => fnDeleteQuote(objQuote.strQuoteId)}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </>
                )}
                {/* Approval buttons - for Partner users when quote is sent */}
                {objUser && !fnCanBypassPartnerIsolation(objUser.strRole) && objQuote.strStatus === 'sent' && (
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
                
                {/* Convert to Order button for approved quotes */}
                {objUser && fnHasPermission(objUser.strRole, 'quote:manage') && objQuote.strStatus === 'approved' && !objQuote.bHasOrder && (
                  <button 
                    onClick={() => fnConvertQuoteToOrder(objQuote.strQuoteId)}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                  >
                    Convert to Order
                  </button>
                )}
                
                {/* Show "Order Created" indicator if quote has been converted */}
                {objQuote.bHasOrder && (
                  <div className="flex-1 bg-gray-100 text-gray-600 px-3 py-2 rounded text-sm font-medium text-center">
                    Order Created
                  </div>
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

             {/* Quote Details Modal */}
       {bShowQuoteDetailsModal && objSelectedQuote && (
         <QuoteDetailsModal
           quote={objSelectedQuote}
           onClose={() => {
             setBShowQuoteDetailsModal(false);
             setObjSelectedQuote(null);
           }}
           onStatusUpdate={fnUpdateQuoteStatus}
           onDelete={fnDeleteQuote}
           canManageQuotes={objUser ? fnCanManageQuotes(objUser.strRole) : false}
           getStatusColor={fnGetStatusColor}
           objUser={objUser}
         />
       )}
        </div>
  );
}

// Quote Details Modal Component
function QuoteDetailsModal({
  quote,
  onClose,
  onStatusUpdate,
  onDelete,
  canManageQuotes,
  getStatusColor,
  objUser
}: {
  quote: IQuote;
  onClose: () => void;
  onStatusUpdate: (quoteId: string, status: string, notes?: string) => void;
  onDelete: (quoteId: string) => void;
  canManageQuotes: boolean;
  getStatusColor: (status: string, objUser?: IUser | null) => string;
  objUser?: IUser | null;
}) {
  const [strNewStatus, setStrNewStatus] = useState(quote.strStatus);
  const [strStatusNotes, setStrStatusNotes] = useState('');
  const [bIsUpdating, setIsUpdating] = useState(false);

  const fnHandleStatusUpdate = async () => {
    if (strNewStatus === quote.strStatus) return;
    
    setIsUpdating(true);
    try {
      await onStatusUpdate(quote.strQuoteId, strNewStatus, strStatusNotes);
      onClose();
    } catch (error) {
      console.error('Error updating quote status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const fnGetStatusDisplayName = (strStatus: string, objUser?: IUser | null): string => {
    if (!strStatus) return 'No Status';
    
    // For Partner users, don't show "sent" status - show it as "pending"
    const strDisplayStatus = (objUser && !fnCanBypassPartnerIsolation(objUser.strRole) && strStatus.toLowerCase() === 'sent') 
      ? 'pending' 
      : strStatus.toLowerCase();
    
    const objStatusMap: { [key: string]: string } = {
      'draft': 'Draft',
      'sent': 'Sent',
      'pending': 'Pending Review',
      'approved': 'Approved',
      'rejected': 'Rejected',
      'expired': 'Expired'
    };
    return objStatusMap[strDisplayStatus] || strStatus;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Quote Details</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Quote Header Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quote Information</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Quote Number</label>
                  <p className="text-sm text-gray-900 font-mono">{quote.strQuoteNumber}</p>
                </div>
                                                   <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <div className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold uppercase tracking-wide ${getStatusColor(quote.strStatus, objUser)}`}>
                      {fnGetStatusDisplayName(quote.strStatus, objUser) === 'Draft' && (
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      )}
                      {fnGetStatusDisplayName(quote.strStatus, objUser) === 'Sent' && (
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                        </svg>
                      )}
                      {fnGetStatusDisplayName(quote.strStatus, objUser) === 'Pending Review' && (
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      )}
                      {fnGetStatusDisplayName(quote.strStatus, objUser) === 'Approved' && (
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      {fnGetStatusDisplayName(quote.strStatus, objUser) === 'Rejected' && (
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      )}
                      {fnGetStatusDisplayName(quote.strStatus, objUser) === 'Expired' && (
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                      )}
                      {fnGetStatusDisplayName(quote.strStatus, objUser)}
                    </div>
                  </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Created</label>
                  <p className="text-sm text-gray-900">{new Date(quote.dtCreated).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Updated</label>
                  <p className="text-sm text-gray-900">{new Date(quote.dtUpdated).toLocaleDateString()}</p>
                </div>
                {quote.dtValidUntil && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Valid Until</label>
                    <p className="text-sm text-gray-900">{new Date(quote.dtValidUntil).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-700">Subtotal:</span>
                  <span className="text-sm font-medium">${quote.decSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-700">Discount:</span>
                  <span className="text-sm font-medium">${quote.decDiscountAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm font-semibold">Total:</span>
                  <span className="text-sm font-semibold">${quote.decTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quote Items */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quote Items</h3>
            <div className="bg-gray-50 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Line Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {quote.arrItems?.map((item, index) => (
                    <tr key={item.strQuoteItemId || index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.strProductName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.strProductCode}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.intQuantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${item.decUnitPrice.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${item.decLineTotal.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {item.strNotes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          {quote.strNotes && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-900">{quote.strNotes}</p>
              </div>
            </div>
          )}

          {/* Status Update Section - Only for users who can manage quotes */}
          {canManageQuotes && (
            (quote.strStatus === 'draft' && objUser && fnCanBypassPartnerIsolation(objUser.strRole)) || 
            (quote.strStatus === 'sent' && objUser && !fnCanBypassPartnerIsolation(objUser.strRole))
          ) && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Update Status</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">New Status</label>
                  <select
                    value={strNewStatus}
                    onChange={(e) => setStrNewStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {quote.strStatus === 'draft' && objUser && fnCanBypassPartnerIsolation(objUser.strRole) && (
                      <>
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                      </>
                    )}
                    {quote.strStatus === 'sent' && objUser && !fnCanBypassPartnerIsolation(objUser.strRole) && (
                      <>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status Notes</label>
                  <textarea
                    value={strStatusNotes}
                    onChange={(e) => setStrStatusNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional notes about this status change..."
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={fnHandleStatusUpdate}
                    disabled={bIsUpdating || strNewStatus === quote.strStatus}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {bIsUpdating ? 'Updating...' : 'Update Status'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete button for draft quotes */}
          {canManageQuotes && quote.strStatus === 'draft' && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Danger Zone</h3>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700 mb-4">
                  Once you delete a quote, there is no going back. Please be certain.
                </p>
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      onDelete(quote.strQuoteId);
                      onClose();
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors"
                  >
                    Delete Quote
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Close button for non-managers */}
          {!canManageQuotes && (
            <div className="border-t border-gray-200 pt-6">
              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
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
      decUnitPrice: number; // Partner price (what provider gets paid)
      decCustomerUnitPrice: number; // Customer price (what partner charges customer)
      strNotes: string;
    }>;
  }) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const [strNotes, setStrNotes] = useState('');
  const [dtValidUntil, setDtValidUntil] = useState('');
  const [strPartnerId, setStrPartnerId] = useState('');
  const [arrPartnerPrices, setArrPartnerPrices] = useState<any[]>([]);
  const [bIsLoadingPartnerPrices, setIsLoadingPartnerPrices] = useState(false);
  const [arrItems, setArrItems] = useState<Array<{
    strProductId: string;
    intQuantity: number;
    decUnitPrice: number; // Partner price (what provider gets paid)
    decCustomerUnitPrice: number; // Customer price (what partner charges customer)
    strNotes: string;
  }>>([]);

  // Check if user is a partner (can set customer pricing)
  const bIsPartnerUser = objUser?.strRole === 'partner_admin' || objUser?.strRole === 'partner_user';

  // Load partner pricing when partner is selected
  const fnLoadPartnerPrices = async (strPartnerId: string) => {
    if (!strPartnerId) {
      setArrPartnerPrices([]);
      return;
    }

    try {
      setIsLoadingPartnerPrices(true);
      const response = await fetch(`/api/partners/${strPartnerId}/prices`);
      const data = await response.json();
      
      if (data.success) {
        setArrPartnerPrices(data.products || []);
      } else {
        setArrPartnerPrices([]);
      }
    } catch (error) {
      console.error('Error loading partner prices:', error);
      setArrPartnerPrices([]);
    } finally {
      setIsLoadingPartnerPrices(false);
    }
  };

  // Handle partner selection
  const fnHandlePartnerSelect = (strSelectedPartnerId: string) => {
    setStrPartnerId(strSelectedPartnerId);
    
    if (strSelectedPartnerId) {
      fnLoadPartnerPrices(strSelectedPartnerId);
    } else {
      setArrPartnerPrices([]);
    }

    // Update existing items with new pricing
    setArrItems(prevItems => 
      prevItems.map(item => {
        if (item.strProductId) {
          const objProduct = products.find(p => p.strProductId === item.strProductId);
          if (objProduct) {
            // Find partner-specific price
            const partnerPrice = arrPartnerPrices.find(p => p.strProductId === item.strProductId);
            const decPartnerPrice = partnerPrice?.decPartnerPrice || objProduct.decBasePrice;
            
            return {
              ...item,
              decUnitPrice: decPartnerPrice,
              decCustomerUnitPrice: decPartnerPrice // Default customer price same as partner price
            };
          }
        }
        return item;
      })
    );
  };

  // Get the correct price for a product based on selected partner
  const fnGetProductPrice = (strProductId: string): number => {
    const objProduct = products.find(p => p.strProductId === strProductId);
    if (!objProduct) return 0;

    if (strPartnerId) {
      // Use partner-specific price if available
      const partnerPrice = arrPartnerPrices.find(p => p.strProductId === strProductId);
      return partnerPrice?.decPartnerPrice || objProduct.decBasePrice;
    } else {
      // Use display price or base price
      return objProduct.decDisplayPrice || objProduct.decPartnerPrice || objProduct.decBasePrice;
    }
  };

  const fnAddItem = () => {
    setArrItems([...arrItems, {
      strProductId: '',
      intQuantity: 1,
      decUnitPrice: 0,
      decCustomerUnitPrice: 0,
      strNotes: ''
    }]);
  };

  const fnRemoveItem = (intIndex: number) => {
    setArrItems(arrItems.filter((_, index) => index !== intIndex));
  };

  const fnUpdateItem = (intIndex: number, strField: string, value: string | number) => {
    const arrNewItems = [...arrItems];
    arrNewItems[intIndex] = { ...arrNewItems[intIndex], [strField]: value };
    
    // Auto-calculate unit prices when product is selected
    if (strField === 'strProductId') {
      const decPartnerPrice = fnGetProductPrice(value as string);
      arrNewItems[intIndex].decUnitPrice = decPartnerPrice;
      arrNewItems[intIndex].decCustomerUnitPrice = decPartnerPrice; // Default customer price same as partner price
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
      item.strProductId && item.intQuantity > 0 && item.decUnitPrice > 0 && item.decCustomerUnitPrice > 0
    );

    if (arrValidItems.length === 0) {
      alert('Please fill in all required fields for quote items');
      return;
    }

    // Validate that customer prices don't exceed partner prices (for partner users)
    if (bIsPartnerUser) {
      const arrInvalidItems = arrValidItems.filter(item => item.decCustomerUnitPrice > item.decUnitPrice);
      if (arrInvalidItems.length > 0) {
        alert('Customer prices cannot exceed partner prices. Any discount comes at your expense.');
        return;
      }
    }

    onSubmit({
      strNotes,
      dtValidUntil,
      strPartnerId: strPartnerId || undefined,
      arrItems: arrValidItems
    });
  };

  const fnCalculatePartnerTotal = (): number => {
    return arrItems.reduce((total, item) => {
      return total + (item.intQuantity * item.decUnitPrice);
    }, 0);
  };

  const fnCalculateCustomerTotal = (): number => {
    return arrItems.reduce((total, item) => {
      return total + (item.intQuantity * item.decCustomerUnitPrice);
    }, 0);
  };

  const fnCalculatePartnerMargin = (): number => {
    return fnCalculatePartnerTotal() - fnCalculateCustomerTotal();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create New Quote</h2>
          {bIsPartnerUser && (
            <p className="text-sm text-blue-600 mt-1">
              You can offer customer discounts. Any discount comes at your expense.
            </p>
          )}
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
                <div className="relative">
                  <select
                    value={strPartnerId}
                    onChange={(e) => fnHandlePartnerSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a partner (optional)</option>
                    {partners.map((partner) => (
                      <option key={partner.strPartnerId} value={partner.strPartnerId}>
                        {partner.strPartnerName} ({partner.strPartnerCode})
                      </option>
                    ))}
                  </select>
                  {bIsLoadingPartnerPrices && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                </div>
                {strPartnerId && (
                  <p className="text-xs text-blue-600 mt-1">
                    Partner-specific pricing will be applied to all products
                  </p>
                )}
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
                <p>No items added yet. Click "Add Item" to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {arrItems.map((item, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                          {products.map((product) => {
                            const decPrice = fnGetProductPrice(product.strProductId);
                            const partnerPrice = arrPartnerPrices.find(p => p.strProductId === product.strProductId);
                            const hasCustomPrice = partnerPrice?.bHasCustomPrice || false;
                            
                            return (
                              <option key={product.strProductId} value={product.strProductId}>
                                {product.strProductName} - ${decPrice.toFixed(2)}
                                {hasCustomPrice && strPartnerId && ' (Custom)'}
                              </option>
                            );
                          })}
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
                          {bIsPartnerUser ? 'Partner Price' : 'Unit Price'}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.decUnitPrice}
                          onChange={(e) => fnUpdateItem(index, 'decUnitPrice', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                          readOnly={!bIsPartnerUser} // Only partners can edit partner prices
                        />
                        {item.strProductId && strPartnerId && (
                          <p className="text-xs text-gray-500 mt-1">
                            {(() => {
                              const partnerPrice = arrPartnerPrices.find(p => p.strProductId === item.strProductId);
                              const objProduct = products.find(p => p.strProductId === item.strProductId);
                              if (partnerPrice?.bHasCustomPrice && objProduct) {
                                return `Custom price (Base: $${objProduct.decBasePrice.toFixed(2)})`;
                              }
                              return 'Using partner pricing';
                            })()}
                          </p>
                        )}
                      </div>

                      {bIsPartnerUser && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Customer Price
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.decCustomerUnitPrice}
                            onChange={(e) => fnUpdateItem(index, 'decCustomerUnitPrice', parseFloat(e.target.value) || 0)}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              item.decCustomerUnitPrice > item.decUnitPrice ? 'border-red-300' : 'border-gray-300'
                            }`}
                            required
                          />
                          {item.decCustomerUnitPrice > item.decUnitPrice && (
                            <p className="text-xs text-red-600 mt-1">
                              Cannot exceed partner price
                            </p>
                          )}
                          {item.decCustomerUnitPrice < item.decUnitPrice && (
                            <p className="text-xs text-orange-600 mt-1">
                              Discount: ${((item.decUnitPrice - item.decCustomerUnitPrice) * item.intQuantity).toFixed(2)}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex items-end space-x-2">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Line Total
                          </label>
                          <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm font-medium">
                            {bIsPartnerUser ? (
                              <div>
                                <div>Partner: ${(item.intQuantity * item.decUnitPrice).toFixed(2)}</div>
                                <div className="text-blue-600">Customer: ${(item.intQuantity * item.decCustomerUnitPrice).toFixed(2)}</div>
                              </div>
                            ) : (
                              `$${(item.intQuantity * item.decUnitPrice).toFixed(2)}`
                            )}
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

          <div className="border-t border-gray-200 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">Partner Total</div>
                <div className="text-lg font-semibold text-gray-900">
                  ${fnCalculatePartnerTotal().toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">What provider gets paid</div>
              </div>
              
              {bIsPartnerUser && (
                <>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-sm text-blue-600">Customer Total</div>
                    <div className="text-lg font-semibold text-blue-700">
                      ${fnCalculateCustomerTotal().toFixed(2)}
                    </div>
                    <div className="text-xs text-blue-500">What customer pays</div>
                  </div>
                  
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-sm text-orange-600">Your Margin</div>
                    <div className={`text-lg font-semibold ${fnCalculatePartnerMargin() >= 0 ? 'text-orange-700' : 'text-red-600'}`}>
                      ${fnCalculatePartnerMargin().toFixed(2)}
                    </div>
                    <div className="text-xs text-orange-500">Your profit/loss</div>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Creating...' : 'Create Quote'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
} 