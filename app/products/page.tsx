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
  decBasePrice: number;
  decDisplayPrice?: number; // New field from API
  decPartnerPrice?: number; // Optional for backward compatibility
  decDiscountRate?: number; // Optional for backward compatibility
  strCategory: string;
  intStockQuantity?: number;
  strDependencyId?: string; // Product ID that this product depends on
  bIsActive: boolean;
  dtCreated: string;
}

interface IPartner {
  strPartnerId: string;
  strPartnerName: string;
  strPartnerCode: string;
  strContactEmail: string;
  strContactPhone?: string;
  strAddress?: string;
  strCity?: string;
  strState?: string;
  strCountry?: string;
  strPostalCode?: string;
  bIsActive: boolean;
}

interface IPartnerPrice {
  strProductId: string;
  decPartnerPrice: number;
  bHasCustomPrice: boolean;
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

export default function ProductsPage() {
  const [arrProducts, setArrProducts] = useState<IProduct[]>([]);
  const [arrPartners, setArrPartners] = useState<IPartner[]>([]);
  const [objUser, setObjUser] = useState<IUser | null>(null);
  const [bIsLoading, setIsLoading] = useState(true);
  const [bIsCreating, setIsCreating] = useState(false);
  const [bIsEditing, setIsEditing] = useState(false);
  const [bIsManagingPricing, setIsManagingPricing] = useState(false);
  const [objEditingProduct, setObjEditingProduct] = useState<IProduct | null>(null);
  const [objSelectedProduct, setObjSelectedProduct] = useState<IProduct | null>(null);
  const [strError, setStrError] = useState('');
  const router = useRouter();

  // Check if user has permission to manage products
  const fnCanManageProducts = (strRole: string): boolean => {
    return fnHasPermission(strRole, 'product:manage');
  };

  // Check if user has permission to view products
  const fnCanViewProducts = (strRole: string): boolean => {
    return fnHasPermission(strRole, 'product:view') || fnHasPermission(strRole, 'product:manage');
  };

  // Check if user has permission to manage partner pricing
  const fnCanManagePartnerPricing = (strRole: string): boolean => {
    return fnHasPermission(strRole, 'partner:manage');
  };

  // Helper function to get available dependencies for a product
  const fnGetAvailableDependencies = (strProductId?: string): IProduct[] => {
    if (!strProductId) {
      // For new products, all products are available as dependencies
      return arrProducts.filter(product => product.bIsActive);
    }

    // For existing products, exclude the product itself and any products that depend on it
    const arrExcludedIds = new Set<string>();
    arrExcludedIds.add(strProductId);

    // Find all products that depend on this product (directly or indirectly)
    const fnFindDependents = (strTargetId: string) => {
      arrProducts.forEach(product => {
        if (product.strDependencyId === strTargetId && !arrExcludedIds.has(product.strProductId)) {
          arrExcludedIds.add(product.strProductId);
          fnFindDependents(product.strProductId);
        }
      });
    };

    fnFindDependents(strProductId);

    return arrProducts.filter(product => 
      product.bIsActive && !arrExcludedIds.has(product.strProductId)
    );
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

        // Check if user has permission to view products
        if (!fnCanViewProducts(objCurrentUser.strRole)) {
          setStrError('Access denied. You do not have permission to view products.');
          setIsLoading(false);
          return;
        }

        // Load products - middleware handles authentication via cookies
        const objProductsResponse = await fetch('/api/products', {
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const objProductsData = await objProductsResponse.json();
        
        if (objProductsData.success) {
          setArrProducts(objProductsData.products);
        } else {
          setStrError('Failed to load products');
        }

        // Load partners if user can manage partner pricing
        if (fnCanManagePartnerPricing(objCurrentUser.strRole)) {
          const objPartnersResponse = await fetch('/api/partners', {
            headers: {
              'Content-Type': 'application/json',
            },
          });
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

  const fnCreateProduct = async (objProductData: Omit<IProduct, 'strProductId' | 'dtCreated'>) => {
    try {
      setIsCreating(true);
      const objResponse = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(objProductData),
      });

      const objData = await objResponse.json();
      
      if (objData.success) {
        // Reload products
        const objProductsResponse = await fetch('/api/products');
        const objProductsData = await objProductsResponse.json();
        if (objProductsData.success) {
          setArrProducts(objProductsData.products);
        }
      } else {
        setStrError(objData.message || 'Failed to create product');
      }
    } catch (error) {
      setStrError('Error creating product');
    } finally {
      setIsCreating(false);
    }
  };

  const fnUpdateProduct = async (strProductId: string, objProductData: Partial<IProduct>) => {
    try {
      const objResponse = await fetch(`/api/products/${strProductId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(objProductData),
      });

      const objData = await objResponse.json();
      
      if (objData.success) {
        // Reload products
        const objProductsResponse = await fetch('/api/products');
        const objProductsData = await objProductsResponse.json();
        if (objProductsData.success) {
          setArrProducts(objProductsData.products);
        }
        // Close edit modal
        setObjEditingProduct(null);
        setIsEditing(false);
      } else {
        setStrError(objData.message || 'Failed to update product');
      }
    } catch (error) {
      setStrError('Error updating product');
    }
  };

  const fnOpenEditModal = (objProduct: IProduct) => {
    setObjEditingProduct(objProduct);
    setIsEditing(true);
  };

  const fnCloseEditModal = () => {
    setObjEditingProduct(null);
    setIsEditing(false);
  };

  const fnOpenPricingModal = () => {
    setIsManagingPricing(true);
  };

  const fnClosePricingModal = () => {
    setIsManagingPricing(false);
    setObjSelectedProduct(null);
  };

  const fnDeleteProduct = async (strProductId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      const objResponse = await fetch(`/api/products/${strProductId}`, {
        method: 'DELETE',
      });

      const objData = await objResponse.json();
      
      if (objData.success) {
        // Reload products
        const objProductsResponse = await fetch('/api/products');
        const objProductsData = await objProductsResponse.json();
        if (objProductsData.success) {
          setArrProducts(objProductsData.products);
        }
      } else {
        setStrError(objData.message || 'Failed to delete product');
      }
    } catch (error) {
      setStrError('Error deleting product');
    }
  };

  if (bIsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading products...</p>
          </div>
        </div>
      </div>
    );
  }

  if (strError && !fnCanViewProducts(objUser?.strRole || '')) {
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
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {fnCanManageProducts(objUser?.strRole || '') ? 'Manage Products' : 'Products'}
            </h1>
            <p className="text-gray-600">
              {fnCanManageProducts(objUser?.strRole || '') 
                ? 'Create, edit, and manage product catalog with partner-specific pricing.'
                : 'View available products with partner-specific pricing.'
              }
            </p>
          </div>
          <div className="flex space-x-3">
            {fnCanManagePartnerPricing(objUser?.strRole || '') && (
              <button
                onClick={fnOpenPricingModal}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
                <span>Partner Pricing</span>
              </button>
            )}
            {fnCanManageProducts(objUser?.strRole || '') && (
              <button
                onClick={() => setIsCreating(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Add Product</span>
              </button>
            )}
          </div>
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

        {/* Create Product Form - Only show for users who can manage products */}
        {fnCanManageProducts(objUser?.strRole || '') && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Create New Product</h2>
            <CreateProductForm 
              products={fnGetAvailableDependencies()}
              onSubmit={fnCreateProduct} 
              isLoading={bIsCreating} 
            />
          </div>
        )}

        {/* Products List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">
              {fnCanManageProducts(objUser?.strRole || '') ? 'Products' : 'Available Products'} ({arrProducts.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  {fnCanManageProducts(objUser?.strRole || '') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dependency
                    </th>
                  )}
                  {fnCanManageProducts(objUser?.strRole || '') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  )}
                  {fnCanManageProducts(objUser?.strRole || '') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {arrProducts.map((objProduct) => (
                  <tr key={objProduct.strProductId}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {objProduct.strProductName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {objProduct.strDescription}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {objProduct.strCategory}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {fnCanManageProducts(objUser?.strRole || '') ? (
                        <>
                          <div>Base: ${objProduct.decBasePrice?.toFixed(2) || '0.00'}</div>
                        </>
                      ) : (
                        <>
                          <div className="text-lg font-semibold text-blue-600">
                            ${(objProduct.decDisplayPrice || objProduct.decPartnerPrice || objProduct.decBasePrice)?.toFixed(2) || '0.00'}
                          </div>
                        </>
                      )}
                    </td>
                    {fnCanManageProducts(objUser?.strRole || '') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {objProduct.strDependencyId ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            Depends on: {arrProducts.find(p => p.strProductId === objProduct.strDependencyId)?.strProductName || 'N/A'}
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                            No Dependency
                          </span>
                        )}
                      </td>
                    )}
                    {fnCanManageProducts(objUser?.strRole || '') && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          objProduct.bIsActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {objProduct.bIsActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    )}
                    {fnCanManageProducts(objUser?.strRole || '') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => fnOpenEditModal(objProduct)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => fnUpdateProduct(objProduct.strProductId, { bIsActive: !objProduct.bIsActive })}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          {objProduct.bIsActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => fnDeleteProduct(objProduct.strProductId)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Product Modal - Only show for users who can manage products */}
      {bIsEditing && objEditingProduct && fnCanManageProducts(objUser?.strRole || '') && (
        <EditProductModal
          product={objEditingProduct}
          products={fnGetAvailableDependencies(objEditingProduct.strProductId)}
          onSave={fnUpdateProduct}
          onClose={fnCloseEditModal}
          isLoading={bIsEditing}
        />
      )}

      {/* Partner Pricing Modal - Only show for users who can manage partner pricing */}
      {bIsManagingPricing && fnCanManagePartnerPricing(objUser?.strRole || '') && (
        <PartnerPricingModal
          products={arrProducts}
          partners={arrPartners}
          onClose={fnClosePricingModal}
        />
      )}
    </div>
  );
}

// Partner Pricing Modal Component
function PartnerPricingModal({ 
  products, 
  partners,
  onClose 
}: { 
  products: IProduct[];
  partners: IPartner[];
  onClose: () => void;
}) {
  const [strSelectedPartnerId, setStrSelectedPartnerId] = useState<string>('');
  const [objSelectedPartner, setObjSelectedPartner] = useState<IPartner | null>(null);
  const [arrPartnerPrices, setArrPartnerPrices] = useState<IPartnerPrice[]>([]);
  const [bIsLoading, setIsLoading] = useState(false);
  const [bIsSaving, setIsSaving] = useState(false);
  const [strError, setStrError] = useState('');

  const fnLoadPartnerPrices = async (strPartnerId: string) => {
    try {
      setIsLoading(true);
      setStrError('');
      
      const response = await fetch(`/api/partners/${strPartnerId}/prices`);
      const data = await response.json();
      
      if (data.success) {
        setArrPartnerPrices(data.products || []);
      } else {
        setStrError('Error loading partner prices');
      }
    } catch (error) {
      setStrError('Error loading partner prices');
    } finally {
      setIsLoading(false);
    }
  };

  const fnHandlePartnerSelect = (strPartnerId: string) => {
    setStrSelectedPartnerId(strPartnerId);
    const partner = partners.find(p => p.strPartnerId === strPartnerId);
    setObjSelectedPartner(partner || null);
    if (strPartnerId) {
      fnLoadPartnerPrices(strPartnerId);
    } else {
      setArrPartnerPrices([]);
    }
  };

  const fnUpdatePartnerPrice = async (strProductId: string, decPartnerPrice: number) => {
    if (!strSelectedPartnerId) return;
    
    try {
      setIsSaving(true);
      
      const response = await fetch(`/api/partners/${strSelectedPartnerId}/prices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          arrPrices: [{
            strProductId: strProductId,
            decPartnerPrice: decPartnerPrice
          }]
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Update local state
        setArrPartnerPrices(prev => 
          prev.map(price => 
            price.strProductId === strProductId 
              ? { ...price, decPartnerPrice, bHasCustomPrice: true }
              : price
          )
        );
      } else {
        setStrError('Failed to update partner price');
      }
    } catch (error) {
      setStrError('Error updating partner price');
    } finally {
      setIsSaving(false);
    }
  };

  const fnResetToBasePrice = async (strProductId: string, decBasePrice: number) => {
    await fnUpdatePartnerPrice(strProductId, decBasePrice);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-4/5 max-w-6xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Partner Pricing Management
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {strError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-700">{strError}</p>
            </div>
          )}

          {/* Partner Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Partner
            </label>
            <select
              value={strSelectedPartnerId}
              onChange={(e) => fnHandlePartnerSelect(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Choose a partner...</option>
              {partners.map((partner) => (
                <option key={partner.strPartnerId} value={partner.strPartnerId}>
                  {partner.strPartnerName} ({partner.strPartnerCode})
                </option>
              ))}
            </select>
          </div>

          {/* Partner Information */}
          {objSelectedPartner && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">
                {objSelectedPartner.strPartnerName}
              </h4>
              <p className="text-sm text-blue-700">
                Code: {objSelectedPartner.strPartnerCode} | 
                Email: {objSelectedPartner.strContactEmail}
              </p>
            </div>
          )}

          {/* Products and Pricing Table */}
          {strSelectedPartnerId && (
            <div>
              <h4 className="font-medium text-gray-900 mb-4">Product Pricing</h4>
              
              {bIsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading pricing data...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Base Price
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Partner Price
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {products.map((product) => {
                        const partnerPrice = arrPartnerPrices.find(p => p.strProductId === product.strProductId);
                        const currentPrice = partnerPrice?.decPartnerPrice || product.decBasePrice;
                        const hasCustomPrice = partnerPrice?.bHasCustomPrice || false;

                        return (
                          <tr key={product.strProductId}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {product.strProductName}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {product.strProductCode}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                ${product.decBasePrice.toFixed(2)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={currentPrice}
                                  placeholder={product.decBasePrice.toFixed(2)}
                                  className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    if (!isNaN(value) && value > 0) {
                                      fnUpdatePartnerPrice(product.strProductId, value);
                                    }
                                  }}
                                  disabled={bIsSaving}
                                />
                                {hasCustomPrice && (
                                  <span className="text-xs text-green-600 font-medium">
                                    Custom
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                onClick={() => fnResetToBasePrice(product.strProductId, product.decBasePrice)}
                                className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
                                disabled={bIsSaving || !hasCustomPrice}
                                title="Reset to base price"
                              >
                                Reset
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-4">
            <button
              onClick={onClose}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Edit Product Modal Component
function EditProductModal({ 
  product, 
  products,
  onSave, 
  onClose, 
  isLoading 
}: { 
  product: IProduct;
  products: IProduct[];
  onSave: (productId: string, data: Partial<IProduct>) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const [strProductName, setStrProductName] = useState(product.strProductName);
  const [strDescription, setStrDescription] = useState(product.strDescription);
  const [decBasePrice, setDecBasePrice] = useState(product.decBasePrice.toString());
  const [strCategory, setStrCategory] = useState(product.strCategory);
  const [bIsActive, setBIsActive] = useState(product.bIsActive);
  const [strDependencyId, setStrDependencyId] = useState<string | undefined>(product.strDependencyId);

  const fnHandleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!strProductName || !strDescription || !decBasePrice || !strCategory) {
      return;
    }

    onSave(product.strProductId, {
      strProductName,
      strDescription,
      decBasePrice: parseFloat(decBasePrice),
      strCategory,
      bIsActive,
      strDependencyId,
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Edit Product</h3>
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
                Product Name
              </label>
              <input
                type="text"
                value={strProductName}
                onChange={(e) => setStrProductName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={strCategory}
                onChange={(e) => setStrCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Category</option>
                <option value="Software">Software</option>
                <option value="Hardware">Hardware</option>
                <option value="Services">Services</option>
                <option value="Consulting">Consulting</option>
                <option value="Support">Support</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={strDescription}
                onChange={(e) => setStrDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={decBasePrice}
                onChange={(e) => setDecBasePrice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dependency
              </label>
              <select
                value={strDependencyId || ''}
                onChange={(e) => setStrDependencyId(e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No Dependency</option>
                {products.map((product: IProduct) => (
                  <option key={product.strProductId} value={product.strProductId}>
                    {product.strProductName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={bIsActive}
                onChange={(e) => setBIsActive(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                Active
              </label>
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
                disabled={isLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Create Product Form Component
function CreateProductForm({ 
  products,
  onSubmit, 
  isLoading 
}: { 
  products: IProduct[];
  onSubmit: (data: Omit<IProduct, 'strProductId' | 'dtCreated'>) => void;
  isLoading: boolean;
}) {
  const [strProductName, setStrProductName] = useState('');
  const [strDescription, setStrDescription] = useState('');
  const [decBasePrice, setDecBasePrice] = useState('');
  const [strCategory, setStrCategory] = useState('');
  const [strDependencyId, setStrDependencyId] = useState<string | undefined>(undefined);

  const fnHandleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!strProductName || !strDescription || !decBasePrice || !strCategory) {
      return;
    }

    onSubmit({
      strProductName,
      strProductCode: strProductName.toUpperCase().replace(/\s+/g, '_'),
      strDescription,
      decBasePrice: parseFloat(decBasePrice),
      strCategory,
      bIsActive: true,
      strDependencyId,
    });

    // Reset form
    setStrProductName('');
    setStrDescription('');
    setDecBasePrice('');
    setStrCategory('');
    setStrDependencyId(undefined);
  };

  return (
    <form onSubmit={fnHandleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product Name
          </label>
          <input
            type="text"
            value={strProductName}
            onChange={(e) => setStrProductName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            value={strCategory}
            onChange={(e) => setStrCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select Category</option>
            <option value="Software">Software</option>
            <option value="Hardware">Hardware</option>
            <option value="Services">Services</option>
            <option value="Consulting">Consulting</option>
            <option value="Support">Support</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={strDescription}
          onChange={(e) => setStrDescription(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Price ($)
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={decBasePrice}
          onChange={(e) => setDecBasePrice(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Dependency
        </label>
        <select
          value={strDependencyId || ''}
          onChange={(e) => setStrDependencyId(e.target.value || undefined)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">No Dependency</option>
          {products.map((product: IProduct) => (
            <option key={product.strProductId} value={product.strProductId}>
              {product.strProductName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Creating...' : 'Create Product'}
        </button>
      </div>
    </form>
  );
} 