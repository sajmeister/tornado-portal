'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fnHasPermission } from '../../src/lib/roles';
import { fnNotifyOrderStatusChange, fnNotifyOrderCreated, fnNotifyQuoteConverted } from '../../src/lib/notifications';
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

export default function OrdersPage() {
  const [arrOrders, setArrOrders] = useState<IOrder[]>([]);
  const [arrQuotes, setArrQuotes] = useState<IQuote[]>([]);
  const [objUser, setObjUser] = useState<IUser | null>(null);
  const [bIsLoading, setIsLoading] = useState(true);
  const [bShowConvertModal, setBShowConvertModal] = useState(false);
  const [bShowOrderDetailsModal, setBShowOrderDetailsModal] = useState(false);
  const [objSelectedQuote, setObjSelectedQuote] = useState<IQuote | null>(null);
  const [objSelectedOrder, setObjSelectedOrder] = useState<IOrder | null>(null);
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
              quote.strStatus === 'approved' && quote.bIsActive && !quote.bHasOrder
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
      
      // Find the quote to get its number
      const objQuote = arrQuotes.find(quote => quote.strQuoteId === strQuoteId);
      const strQuoteNumber = objQuote?.strQuoteNumber || '';

      const objResponse = await fetch('/api/orders/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ strQuoteId }),
      });

      const objData = await objResponse.json();
      
      if (objData.success) {
        // Send notification for quote conversion
        const strOrderNumber = objData.order?.strOrderNumber || 'new order';
        fnNotifyQuoteConverted(strQuoteNumber, strOrderNumber);
        
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
            quote.strStatus === 'approved' && quote.bIsActive && !quote.bHasOrder
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
      // Find the current order to get its status and number
      const objCurrentOrder = arrOrders.find(order => order.strOrderId === strOrderId);
      const strOldStatus = objCurrentOrder?.strStatus || 'unknown';
      const strOrderNumber = objCurrentOrder?.strOrderNumber || '';

      const objResponse = await fetch(`/api/orders/${strOrderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ strStatus: strNewStatus, strNotes }),
      });

      const objData = await objResponse.json();
      
      if (objData.success) {
        // Send notification for status change
        fnNotifyOrderStatusChange(strOrderNumber, strOldStatus, strNewStatus);
        
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
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'processing':
        return 'bg-indigo-100 text-indigo-800';
      case 'provisioning':
        return 'bg-purple-100 text-purple-800';
      case 'testing':
        return 'bg-orange-100 text-orange-800';
      case 'ready':
        return 'bg-teal-100 text-teal-800';
      case 'shipped':
        return 'bg-pink-100 text-pink-800';
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
      case 'confirmed':
        return 'Confirmed';
      case 'processing':
        return 'Processing';
      case 'provisioning':
        return 'Provisioning';
      case 'testing':
        return 'Testing';
      case 'ready':
        return 'Ready';
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

  // Get order processing step number for progress indicator
  const fnGetOrderStepNumber = (strStatus: string): number => {
    const arrStatusOrder = [
      'pending', 'confirmed', 'processing', 'provisioning', 'testing', 'ready', 'shipped', 'delivered'
    ];
    const intStepIndex = arrStatusOrder.indexOf(strStatus.toLowerCase());
    return intStepIndex >= 0 ? intStepIndex + 1 : 0;
  };

  // Get total number of steps for progress calculation
  const fnGetTotalSteps = (): number => {
    return 8; // pending, confirmed, processing, provisioning, testing, ready, shipped, delivered
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
                      <div className="space-y-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${fnGetStatusColor(objOrder.strStatus)}`}>
                          {fnGetStatusDisplayName(objOrder.strStatus)}
                        </span>
                        {/* Progress Indicator */}
                        {!['cancelled', 'delivered'].includes(objOrder.strStatus.toLowerCase()) && (
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ 
                                width: `${(fnGetOrderStepNumber(objOrder.strStatus) / fnGetTotalSteps()) * 100}%` 
                              }}
                            ></div>
                          </div>
                        )}
                      </div>
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
                            setObjSelectedOrder(objOrder);
                            setBShowOrderDetailsModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          View Details
                        </button>
                        {/* Enhanced Status Update Buttons */}
                        {objOrder.strStatus === 'pending' && (
                          <button
                            onClick={() => fnUpdateOrderStatus(objOrder.strOrderId, 'confirmed')}
                            className="text-blue-600 hover:text-blue-900 mr-2"
                          >
                            Confirm
                          </button>
                        )}
                        {objOrder.strStatus === 'confirmed' && (
                          <button
                            onClick={() => fnUpdateOrderStatus(objOrder.strOrderId, 'processing')}
                            className="text-indigo-600 hover:text-indigo-900 mr-2"
                          >
                            Start Processing
                          </button>
                        )}
                        {objOrder.strStatus === 'processing' && (
                          <button
                            onClick={() => fnUpdateOrderStatus(objOrder.strOrderId, 'provisioning')}
                            className="text-purple-600 hover:text-purple-900 mr-2"
                          >
                            Start Provisioning
                          </button>
                        )}
                        {objOrder.strStatus === 'provisioning' && (
                          <button
                            onClick={() => fnUpdateOrderStatus(objOrder.strOrderId, 'testing')}
                            className="text-orange-600 hover:text-orange-900 mr-2"
                          >
                            Start Testing
                          </button>
                        )}
                        {objOrder.strStatus === 'testing' && (
                          <button
                            onClick={() => fnUpdateOrderStatus(objOrder.strOrderId, 'ready')}
                            className="text-teal-600 hover:text-teal-900 mr-2"
                          >
                            Mark Ready
                          </button>
                        )}
                        {objOrder.strStatus === 'ready' && (
                          <button
                            onClick={() => fnUpdateOrderStatus(objOrder.strOrderId, 'shipped')}
                            className="text-pink-600 hover:text-pink-900 mr-2"
                          >
                            Mark Shipped
                          </button>
                        )}
                        {objOrder.strStatus === 'shipped' && (
                          <button
                            onClick={() => fnUpdateOrderStatus(objOrder.strOrderId, 'delivered')}
                            className="text-green-600 hover:text-green-900 mr-2"
                          >
                            Mark Delivered
                          </button>
                        )}
                        {/* Cancel button for orders that can still be cancelled */}
                        {['pending', 'confirmed', 'processing', 'provisioning', 'testing'].includes(objOrder.strStatus.toLowerCase()) && (
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

      {/* Order Details Modal */}
      {bShowOrderDetailsModal && objSelectedOrder && (
        <OrderDetailsModal
          order={objSelectedOrder}
          onClose={() => {
            setBShowOrderDetailsModal(false);
            setObjSelectedOrder(null);
          }}
          onStatusUpdate={fnUpdateOrderStatus}
          canManageOrders={fnCanManageOrders(objUser?.strRole || '')}
          getStatusColor={fnGetStatusColor}
          getStatusDisplayName={fnGetStatusDisplayName}
          getOrderStepNumber={fnGetOrderStepNumber}
          getTotalSteps={fnGetTotalSteps}
        />
      )}

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

// Order Details Modal Component
function OrderDetailsModal({
  order,
  onClose,
  onStatusUpdate,
  canManageOrders,
  getStatusColor,
  getStatusDisplayName,
  getOrderStepNumber,
  getTotalSteps
}: {
  order: IOrder;
  onClose: () => void;
  onStatusUpdate: (orderId: string, status: string, notes?: string) => void;
  canManageOrders: boolean;
  getStatusColor: (status: string) => string;
  getStatusDisplayName: (status: string) => string;
  getOrderStepNumber: (status: string) => number;
  getTotalSteps: () => number;
}) {
  const [strNewStatus, setStrNewStatus] = useState('');
  const [strNotes, setStrNotes] = useState('');
  const [bIsUpdating, setIsUpdating] = useState(false);

  const arrStatusOptions = [
    'pending', 'confirmed', 'processing', 'provisioning', 'testing', 'ready', 'shipped', 'delivered', 'cancelled'
  ];

  const arrProcessingSteps = [
    { status: 'pending', label: 'Order Pending', description: 'Order received and awaiting confirmation' },
    { status: 'confirmed', label: 'Order Confirmed', description: 'Order confirmed and ready for processing' },
    { status: 'processing', label: 'Processing', description: 'Order is being processed and prepared' },
    { status: 'provisioning', label: 'Provisioning', description: 'Resources are being provisioned' },
    { status: 'testing', label: 'Testing', description: 'Order is being tested and validated' },
    { status: 'ready', label: 'Ready', description: 'Order is ready for shipping' },
    { status: 'shipped', label: 'Shipped', description: 'Order has been shipped' },
    { status: 'delivered', label: 'Delivered', description: 'Order has been delivered' }
  ];

  const fnHandleStatusUpdate = async () => {
    if (!strNewStatus) return;
    
    setIsUpdating(true);
    try {
      await onStatusUpdate(order.strOrderId, strNewStatus, strNotes);
      setStrNewStatus('');
      setStrNotes('');
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Order Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Order Information</h3>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Order Number:</span> {order.strOrderNumber}</div>
                <div><span className="font-medium">Partner:</span> {order.strPartnerName}</div>
                <div><span className="font-medium">Created By:</span> {order.strCreatedByName}</div>
                <div><span className="font-medium">Created:</span> {new Date(order.dtCreated).toLocaleString()}</div>
                <div><span className="font-medium">Total:</span> ${order.decTotal.toFixed(2)}</div>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Current Status</h3>
              <div className="space-y-2">
                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(order.strStatus)}`}>
                  {getStatusDisplayName(order.strStatus)}
                </span>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${(getOrderStepNumber(order.strStatus) / getTotalSteps()) * 100}%` 
                    }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500">
                  Step {getOrderStepNumber(order.strStatus)} of {getTotalSteps()}
                </div>
              </div>
            </div>
          </div>

          {/* Processing Steps */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Processing Steps</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {arrProcessingSteps.map((step, index) => {
                const intCurrentStep = getOrderStepNumber(order.strStatus);
                const bIsCompleted = intCurrentStep > index + 1;
                const bIsCurrent = intCurrentStep === index + 1;
                const bIsCancelled = order.strStatus.toLowerCase() === 'cancelled';
                
                return (
                  <div 
                    key={step.status}
                    className={`p-4 rounded-lg border-2 ${
                      bIsCancelled 
                        ? 'border-red-200 bg-red-50' 
                        : bIsCompleted 
                          ? 'border-green-200 bg-green-50' 
                          : bIsCurrent 
                            ? 'border-blue-200 bg-blue-50' 
                            : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center mb-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        bIsCancelled 
                          ? 'bg-red-500 text-white' 
                          : bIsCompleted 
                            ? 'bg-green-500 text-white' 
                            : bIsCurrent 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-gray-300 text-gray-600'
                      }`}>
                        {bIsCompleted ? '✓' : index + 1}
                      </div>
                      <span className={`ml-2 font-medium ${
                        bIsCancelled 
                          ? 'text-red-700' 
                          : bIsCompleted 
                            ? 'text-green-700' 
                            : bIsCurrent 
                              ? 'text-blue-700' 
                              : 'text-gray-500'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                    <p className={`text-xs ${
                      bIsCancelled 
                        ? 'text-red-600' 
                        : bIsCompleted 
                          ? 'text-green-600' 
                          : bIsCurrent 
                            ? 'text-blue-600' 
                            : 'text-gray-400'
                    }`}>
                      {step.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Order Items */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Order Items</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-3">
                {order.arrItems.map((item) => (
                  <div key={item.strOrderItemId} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                    <div>
                      <div className="font-medium">{item.strProductName}</div>
                      <div className="text-sm text-gray-500">{item.strProductCode}</div>
                      {item.strNotes && <div className="text-xs text-gray-400">{item.strNotes}</div>}
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${item.decLineTotal.toFixed(2)}</div>
                      <div className="text-sm text-gray-500">Qty: {item.intQuantity}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Status History */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Status History</h3>
            <div className="space-y-3">
              {order.arrStatusHistory.slice().reverse().map((history) => (
                <div key={history.strStatusHistoryId} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-3 h-3 rounded-full mt-2 ${getStatusColor(history.strStatus).replace('bg-', 'bg-').replace(' text-', '')}`}></div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(history.strStatus)}`}>
                          {getStatusDisplayName(history.strStatus)}
                        </span>
                        <div className="text-sm text-gray-600 mt-1">{history.strNotes}</div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(history.dtCreated).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Status Update Section - Only for users who can manage orders */}
          {canManageOrders && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold mb-4">Update Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Status
                  </label>
                  <select
                    value={strNewStatus}
                    onChange={(e) => setStrNewStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a status</option>
                    {arrStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {getStatusDisplayName(status)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={strNotes}
                    onChange={(e) => setStrNotes(e.target.value)}
                    placeholder="Add notes about this status change"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="mt-4">
                <button
                  onClick={fnHandleStatusUpdate}
                  disabled={!strNewStatus || bIsUpdating}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {bIsUpdating ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
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