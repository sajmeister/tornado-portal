'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fnHasPermission } from '../../src/lib/roles';
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

interface IOrderItem {
  strOrderItemId: string;
  strProductId: string;
  strProductName: string;
  strProductCode: string;
  intQuantity: number;
  decUnitPrice: number;
  decLineTotal: number;
  strNotes: string;
}

interface IOrderStatusHistory {
  strStatusHistoryId: string;
  strOrderId: string;
  strStatus: string;
  strNotes: string;
  strUpdatedBy: string;
  dtCreated: string;
}

interface IOrder {
  strOrderId: string;
  strOrderNumber: string;
  strQuoteId?: string;
  strPartnerId: string;
  strPartnerName: string;
  strCreatedBy: string;
  strCreatedByName: string;
  strStatus: string;
  decSubtotal: number;
  decDiscountAmount: number;
  decTotal: number;
  strShippingAddress?: string;
  strBillingAddress?: string;
  strNotes?: string;
  dtExpectedDelivery?: string;
  dtCreated: string;
  dtUpdated: string;
  bIsActive: boolean;
  arrItems: IOrderItem[];
  arrStatusHistory: IOrderStatusHistory[];
}

interface IQuote {
  strQuoteId: string;
  strQuoteNumber: string;
  strPartnerId: string;
  strPartnerName: string;
  strCreatedBy: string;
  strCreatedByName: string;
  strStatus: string;
  decSubtotal: number;
  decDiscountAmount: number;
  decTotal: number;
  strNotes: string;
  dtValidUntil: string;
  dtCreated: string;
  bIsActive: boolean;
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

export default function OrdersPage() {
  const [arrOrders, setArrOrders] = useState<IOrder[]>([]);
  const [arrQuotes, setArrQuotes] = useState<IQuote[]>([]);
  const [objUser, setObjUser] = useState<IUser | null>(null);
  const [bIsLoading, setIsLoading] = useState(true);
  const [bShowConvertModal, setBShowConvertModal] = useState(false);
  const [objSelectedQuote, setObjSelectedQuote] = useState<IQuote | null>(null);
  const [bIsConverting, setIsConverting] = useState(false);
  const [strError, setStrError] = useState('');
  const router = useRouter();

  // Check if user has permission to manage orders
  const fnCanManageOrders = (strRole: string): boolean => {
    return fnHasPermission(strRole, 'order:manage');
  };

  // Check if user has permission to view orders
  const fnCanViewOrders = (strRole: string): boolean => {
    return fnHasPermission(strRole, 'order:view') || fnHasPermission(strRole, 'order:manage');
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
        if (!fnCanViewOrders(objCurrentUser.strRole)) {
          setStrError('Access denied. You do not have permission to view orders.');
          setIsLoading(false);
          return;
        }

        // Load orders
        const objOrdersResponse = await fetch('/api/orders', {
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const objOrdersData = await objOrdersResponse.json();
        
        if (objOrdersData.success) {
          setArrOrders(objOrdersData.orders);
        } else {
          setStrError('Failed to load orders');
        }

        // Load quotes for conversion (only if user can manage orders)
        if (fnCanManageOrders(objCurrentUser.strRole)) {
          const objQuotesResponse = await fetch('/api/quotes', {
            headers: {
              'Content-Type': 'application/json',
            },
          });
          const objQuotesData = await objQuotesResponse.json();
          
          if (objQuotesData.success) {
            // Filter for approved quotes that haven't been converted to orders
            const arrApprovedQuotes = objQuotesData.quotes.filter((quote: IQuote) => 
              quote.strStatus === 'approved' && quote.bIsActive
            );
            setArrQuotes(arrApprovedQuotes);
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

  const fnConvertQuoteToOrder = async (strQuoteId: string) => {
    try {
      setIsConverting(true);
      const objResponse = await fetch('/api/orders/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ strQuoteId }),
      });

      const objData = await objResponse.json();
      
      if (objData.success) {
        // Reload orders
        const objOrdersResponse = await fetch('/api/orders');
        const objOrdersData = await objOrdersResponse.json();
        if (objOrdersData.success) {
          setArrOrders(objOrdersData.orders);
        }
        
        // Reload quotes (remove the converted one)
        const objQuotesResponse = await fetch('/api/quotes');
        const objQuotesData = await objQuotesResponse.json();
        if (objQuotesData.success) {
          const arrApprovedQuotes = objQuotesData.quotes.filter((quote: IQuote) => 
            quote.strStatus === 'approved' && quote.bIsActive
          );
          setArrQuotes(arrApprovedQuotes);
        }
        
        setBShowConvertModal(false);
        setObjSelectedQuote(null);
      } else {
        setStrError(objData.message || 'Failed to convert quote to order');
      }
    } catch (error) {
      setStrError('Error converting quote to order');
    } finally {
      setIsConverting(false);
    }
  };

  const fnUpdateOrderStatus = async (strOrderId: string, strNewStatus: string, strNotes?: string) => {
    try {
      const objResponse = await fetch(`/api/orders/${strOrderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ strStatus: strNewStatus, strNotes }),
      });

      const objData = await objResponse.json();
      
      if (objData.success) {
        // Reload orders
        const objOrdersResponse = await fetch('/api/orders');
        const objOrdersData = await objOrdersResponse.json();
        if (objOrdersData.success) {
          setArrOrders(objOrdersData.orders);
        }
      } else {
        setStrError(objData.message || 'Failed to update order status');
      }
    } catch (error) {
      setStrError('Error updating order status');
    }
  };

  const fnGetStatusColor = (strStatus: string): string => {
    switch (strStatus.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'shipped':
        return 'bg-purple-100 text-purple-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const fnGetStatusDisplayName = (strStatus: string): string => {
    switch (strStatus.toLowerCase()) {
      case 'pending':
        return 'Pending';
      case 'processing':
        return 'Processing';
      case 'shipped':
        return 'Shipped';
      case 'delivered':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      default:
        return strStatus;
    }
  };

  if (bIsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading orders...</p>
          </div>
        </div>
      </div>
    );
  }

  if (strError && !fnCanViewOrders(objUser?.strRole || '')) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h1 className="text-2xl font-bold text-red-800 mb-4">Access Denied</h1>
            <p className="text-red-700">{strError}</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Back to Dashboard
            </button>
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {fnCanManageOrders(objUser?.strRole || '') ? 'Order Management' : 'Order Tracking'}
          </h1>
          <p className="text-gray-600 mt-2">
            {fnCanManageOrders(objUser?.strRole || '') 
              ? 'Manage and track all orders. Convert approved quotes to orders and update order status.'
              : 'Track the status of your orders and view order history.'
            }
          </p>
          {objUser && (
            <p className="text-sm text-gray-500 mt-1">
              Logged in as: {objUser.strName} ({objUser.strRole})
            </p>
          )}
        </div>

        {/* Error Message */}
        {strError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700">{strError}</p>
            <button
              onClick={() => setStrError('')}
              className="text-red-600 hover:text-red-800 text-sm mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Convert Quote to Order Button - Only for users who can manage orders */}
        {fnCanManageOrders(objUser?.strRole || '') && arrQuotes.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold mb-2">Convert Approved Quotes</h2>
                <p className="text-gray-600">
                  {arrQuotes.length} approved quote{arrQuotes.length !== 1 ? 's' : ''} ready for conversion
                </p>
              </div>
              <button
                onClick={() => setBShowConvertModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Convert Quote to Order
              </button>
            </div>
          </div>
        )}

        {/* Orders List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">
              {fnCanManageOrders(objUser?.strRole || '') ? 'All Orders' : 'Your Orders'} ({arrOrders.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Partner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  {fnCanManageOrders(objUser?.strRole || '') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {arrOrders.map((objOrder) => (
                  <tr key={objOrder.strOrderId}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {objOrder.strOrderNumber}
                        </div>
                        {objOrder.strQuoteId && (
                          <div className="text-sm text-gray-500">
                            From Quote: {objOrder.strQuoteId}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {objOrder.strPartnerName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${fnGetStatusColor(objOrder.strStatus)}`}>
                        {fnGetStatusDisplayName(objOrder.strStatus)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-semibold">${objOrder.decTotal.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">
                        {objOrder.arrItems.length} item{objOrder.arrItems.length !== 1 ? 's' : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(objOrder.dtCreated).toLocaleDateString()}
                    </td>
                    {fnCanManageOrders(objUser?.strRole || '') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            // TODO: Implement order details modal
                            alert('Order details modal - to be implemented');
                          }}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          View Details
                        </button>
                        {objOrder.strStatus === 'pending' && (
                          <button
                            onClick={() => fnUpdateOrderStatus(objOrder.strOrderId, 'processing')}
                            className="text-green-600 hover:text-green-900 mr-4"
                          >
                            Start Processing
                          </button>
                        )}
                        {objOrder.strStatus === 'processing' && (
                          <button
                            onClick={() => fnUpdateOrderStatus(objOrder.strOrderId, 'shipped')}
                            className="text-purple-600 hover:text-purple-900 mr-4"
                          >
                            Mark Shipped
                          </button>
                        )}
                        {objOrder.strStatus === 'shipped' && (
                          <button
                            onClick={() => fnUpdateOrderStatus(objOrder.strOrderId, 'delivered')}
                            className="text-green-600 hover:text-green-900 mr-4"
                          >
                            Mark Delivered
                          </button>
                        )}
                        {['pending', 'processing'].includes(objOrder.strStatus.toLowerCase()) && (
                          <button
                            onClick={() => fnUpdateOrderStatus(objOrder.strOrderId, 'cancelled')}
                            className="text-red-600 hover:text-red-900"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Convert Quote to Order Modal */}
      {bShowConvertModal && (
        <ConvertQuoteModal
          quotes={arrQuotes}
          onConvert={fnConvertQuoteToOrder}
          onClose={() => {
            setBShowConvertModal(false);
            setObjSelectedQuote(null);
          }}
          isLoading={bIsConverting}
        />
      )}
    </div>
  );
}

// Convert Quote to Order Modal Component
function ConvertQuoteModal({ 
  quotes, 
  onConvert, 
  onClose, 
  isLoading 
}: { 
  quotes: IQuote[];
  onConvert: (quoteId: string) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const [strSelectedQuoteId, setStrSelectedQuoteId] = useState('');

  const fnHandleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!strSelectedQuoteId) {
      return;
    }

    onConvert(strSelectedQuoteId);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Convert Quote to Order</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <form onSubmit={fnHandleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Approved Quote
              </label>
              <select
                value={strSelectedQuoteId}
                onChange={(e) => setStrSelectedQuoteId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select a quote...</option>
                {quotes.map((quote) => (
                  <option key={quote.strQuoteId} value={quote.strQuoteId}>
                    {quote.strQuoteNumber} - {quote.strPartnerName} - ${quote.decTotal.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !strSelectedQuoteId}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Converting...' : 'Convert to Order'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 