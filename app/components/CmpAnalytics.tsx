'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, ShoppingCart, Users, Package, Calendar, Filter } from 'lucide-react';

interface IAnalyticsData {
  strUserRole: string;
  strPeriod: string;
  dtStart: string;
  dtEnd: string;
  objPartner?: {
    strPartnerId: string;
    strPartnerName: string;
    strPartnerCode: string;
  };
  objOverall: {
    intTotalQuotes: number;
    intTotalOrders: number;
    decTotalRevenue: number;
    decTotalPartnerRevenue: number;
    decTotalCustomerRevenue?: number;
    decAverageOrderValue: number;
    decProfitMargin?: number;
  };
  arrSalesByPartner?: Array<{
    strPartnerId: string;
    strPartnerName: string;
    strPartnerCode: string;
    intQuotes: number;
    intOrders: number;
    decRevenue: number;
    decPartnerRevenue: number;
  }>;
  arrSalesByCustomer?: Array<{
    strCustomerId: string;
    strCustomerName: string;
    strCustomerEmail: string;
    intQuotes: number;
    intOrders: number;
    decRevenue: number;
    decCustomerRevenue: number;
    decPartnerRevenue: number;
  }>;
  arrTopProducts: Array<{
    strProductId: string;
    strProductName: string;
    strProductCode: string;
    intQuantitySold: number;
    decRevenue: number;
    decPartnerRevenue?: number;
  }>;
  arrMonthlyTrend: Array<{
    strMonth: string;
    intQuotes?: number;
    intOrders: number;
    decRevenue: number;
    decPartnerRevenue: number;
    decCustomerRevenue?: number;
  }>;
}

interface IAnalyticsProps {
  objUser: any;
}

export default function CmpAnalytics({ objUser }: IAnalyticsProps) {
  // Partner Customers don't need sales analytics since they're end consumers
  if (objUser.strRole === 'partner_customer') {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <ShoppingCart className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Analytics Available</h3>
            <p className="text-sm text-gray-500">
              Sales analytics are not available for customer accounts.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const [objAnalytics, setObjAnalytics] = useState<IAnalyticsData | null>(null);
  const [bIsLoading, setBIsLoading] = useState(true);
  const [strPeriod, setStrPeriod] = useState('30');
  const [strError, setStrError] = useState('');

  const fnLoadAnalytics = async () => {
    try {
      setBIsLoading(true);
      setStrError('');
      
      const response = await fetch(`/api/analytics?period=${strPeriod}`);
      const data = await response.json();
      
      if (data.success) {
        setObjAnalytics(data.data);
      } else {
        setStrError(data.error || 'Failed to load analytics');
      }
    } catch (error) {
      console.error('Analytics loading error:', error);
      setStrError('Failed to load analytics data');
    } finally {
      setBIsLoading(false);
    }
  };

  useEffect(() => {
    fnLoadAnalytics();
  }, [strPeriod]);

  const fnFormatCurrency = (decAmount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(decAmount);
  };

  const fnFormatNumber = (intNumber: number) => {
    return new Intl.NumberFormat('en-US').format(intNumber);
  };

  const fnFormatPercentage = (decPercentage: number) => {
    return `${decPercentage.toFixed(1)}%`;
  };

  const fnGetPeriodLabel = (strPeriodValue: string) => {
    switch (strPeriodValue) {
      case '7': return 'Last 7 Days';
      case '30': return 'Last 30 Days';
      case '90': return 'Last 90 Days';
      case '365': return 'Last Year';
      default: return `Last ${strPeriodValue} Days`;
    }
  };

  if (bIsLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-500">Loading analytics...</div>
        </div>
      </div>
    );
  }

  if (strError) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-red-500">Error: {strError}</div>
        </div>
      </div>
    );
  }

  if (!objAnalytics) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-500">No analytics data available</div>
        </div>
      </div>
    );
  }

  const bIsProvider = objAnalytics.strUserRole === 'super_admin' || objAnalytics.strUserRole === 'provider_user';
  const bIsPartnerAdmin = objAnalytics.strUserRole === 'partner_admin';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Sales Analytics</h2>
            <p className="text-gray-600">
              {bIsProvider ? 'Provider Overview' : `${objAnalytics.objPartner?.strPartnerName} Analytics`}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                value={strPeriod}
                onChange={(e) => setStrPeriod(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm"
              >
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
                <option value="365">Last Year</option>
              </select>
            </div>
            <button
              onClick={fnLoadAnalytics}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Refresh
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          {fnGetPeriodLabel(strPeriod)} • {new Date(objAnalytics.dtStart).toLocaleDateString()} - {new Date(objAnalytics.dtEnd).toLocaleDateString()}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ShoppingCart className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{fnFormatNumber(objAnalytics.objOverall.intTotalOrders)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                {bIsProvider ? 'Total Revenue' : 'Customer Revenue'}
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {fnFormatCurrency(objAnalytics.objOverall.decTotalRevenue)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
              <p className="text-2xl font-bold text-gray-900">
                {fnFormatCurrency(objAnalytics.objOverall.decAverageOrderValue)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Package className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Quotes</p>
              <p className="text-2xl font-bold text-gray-900">{fnFormatNumber(objAnalytics.objOverall.intTotalQuotes)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Partner-specific metrics for Partners */}
      {!bIsProvider && objAnalytics.objOverall.decProfitMargin !== undefined && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <div className="bg-white rounded-lg shadow p-6">
             <div className="flex items-center">
               <div className="p-2 bg-indigo-100 rounded-lg">
                 <DollarSign className="h-6 w-6 text-indigo-600" />
               </div>
               <div className="ml-4">
                 <p className="text-sm font-medium text-gray-600">Cost of Goods</p>
                 <p className="text-2xl font-bold text-gray-900">
                   {fnFormatCurrency(objAnalytics.objOverall.decTotalPartnerRevenue || 0)}
                 </p>
               </div>
             </div>
           </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Customer Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {fnFormatCurrency(objAnalytics.objOverall.decTotalCustomerRevenue || 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-teal-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-teal-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Profit Margin</p>
                <p className="text-2xl font-bold text-gray-900">
                  {fnFormatPercentage(objAnalytics.objOverall.decProfitMargin || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sales by Partner/Customer */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            {bIsProvider ? 'Sales by Partner' : bIsPartnerAdmin ? 'Sales by Customer' : 'Sales Overview'}
          </h3>
        </div>
        <div className="p-6">
          {bIsProvider && objAnalytics.arrSalesByPartner && objAnalytics.arrSalesByPartner.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Partner</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quotes</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Partner Revenue</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {objAnalytics.arrSalesByPartner.map((partner) => (
                    <tr key={partner.strPartnerId}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{partner.strPartnerName}</div>
                          <div className="text-sm text-gray-500">{partner.strPartnerCode}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{fnFormatNumber(partner.intQuotes)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{fnFormatNumber(partner.intOrders)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{fnFormatCurrency(partner.decRevenue)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{fnFormatCurrency(partner.decPartnerRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : bIsPartnerAdmin && objAnalytics.arrSalesByCustomer && objAnalytics.arrSalesByCustomer.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quotes</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</th>
                                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Revenue</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost of Goods</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {objAnalytics.arrSalesByCustomer.map((customer) => (
                    <tr key={customer.strCustomerId}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{customer.strCustomerName}</div>
                          <div className="text-sm text-gray-500">{customer.strCustomerEmail}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{fnFormatNumber(customer.intQuotes)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{fnFormatNumber(customer.intOrders)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{fnFormatCurrency(customer.decCustomerRevenue)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{fnFormatCurrency(customer.decPartnerRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No sales data</h3>
              <p className="mt-1 text-sm text-gray-500">
                {bIsProvider ? 'No partner sales data available for this period.' : 'No customer sales data available for this period.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Top Products by Sales</h3>
        </div>
        <div className="p-6">
          {objAnalytics.arrTopProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity Sold</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {bIsProvider ? 'Revenue' : 'Customer Revenue'}
                    </th>
                                         {!bIsProvider && (
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost of Goods</th>
                     )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {objAnalytics.arrTopProducts.map((product) => (
                    <tr key={product.strProductId}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{product.strProductName}</div>
                          <div className="text-sm text-gray-500">{product.strProductCode}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{fnFormatNumber(product.intQuantitySold)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{fnFormatCurrency(product.decRevenue)}</td>
                      {!bIsProvider && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{fnFormatCurrency(product.decPartnerRevenue || 0)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No product sales data</h3>
              <p className="mt-1 text-sm text-gray-500">No product sales data available for this period.</p>
            </div>
          )}
        </div>
      </div>

      {/* Monthly Trend */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Monthly Trend (Last 12 Months)</h3>
        </div>
        <div className="p-6">
          {objAnalytics.arrMonthlyTrend.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {bIsProvider ? 'Revenue' : 'Customer Revenue'}
                    </th>
                                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                       {bIsProvider ? 'Partner Revenue' : 'Cost of Goods'}
                     </th>
                    {!bIsProvider && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quotes</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {objAnalytics.arrMonthlyTrend.map((month) => (
                    <tr key={month.strMonth}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {new Date(month.strMonth + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{fnFormatNumber(month.intOrders)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{fnFormatCurrency(month.decRevenue)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{fnFormatCurrency(month.decPartnerRevenue)}</td>
                      {!bIsProvider && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{fnFormatNumber(month.intQuotes || 0)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No trend data</h3>
              <p className="mt-1 text-sm text-gray-500">No monthly trend data available for this period.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 