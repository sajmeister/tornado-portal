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

  const fnOpenPricingModal = (objProduct: IProduct) => {
    setObjSelectedProduct(objProduct);
    setIsManagingPricing(true);
  };

  const fnClosePricingModal = () => {
    setObjSelectedProduct(null);
    setIsManagingPricing(false);
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {fnCanManageProducts(objUser?.strRole || '') ? 'Product Catalog Management' : 'Product Catalog'}
          </h1>
          <p className="text-gray-600 mt-2">
            {fnCanManageProducts(objUser?.strRole || '') 
              ? 'Manage products for the Tornado Portal. Only Super Admin and Provider User roles can manage products.'
              : 'View available products with partner-specific pricing.'
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
                        {fnCanManagePartnerPricing(objUser?.strRole || '') && (
                          <button
                            onClick={() => fnOpenPricingModal(objProduct)}
                            className="text-green-600 hover:text-green-900 mr-4"
                          >
                            Pricing
                          </button>
                        )}
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
      {bIsManagingPricing && objSelectedProduct && fnCanManagePartnerPricing(objUser?.strRole || '') && (
        <PartnerPricingModal
          product={objSelectedProduct}
          partners={arrPartners}
          onClose={fnClosePricingModal}
        />
      )}
    </div>
  );
}

// Partner Pricing Modal Component
function PartnerPricingModal({ 
  product, 
  partners,
  onClose 
}: { 
  product: IProduct;
  partners: IPartner[];
  onClose: () => void;
}) {
  const [arrPartnerPrices, setArrPartnerPrices] = useState<IPartnerPrice[]>([]);
  const [bIsLoading, setIsLoading] = useState(true);
  const [bIsSaving, setIsSaving] = useState(false);
  const [strError, setStrError] = useState('');

  useEffect(() => {
    const fnLoadPartnerPrices = async () => {
      try {
        setIsLoading(true);
        
        // Load partner prices for this product
        const arrPrices: IPartnerPrice[] = [];
        
        for (const partner of partners) {
          const response = await fetch(`/api/partners/${partner.strPartnerId}/prices`);
          const data = await response.json();
          
          if (data.success) {
            const productPrice = data.products.find((p: any) => p.strProductId === product.strProductId);
            if (productPrice) {
              arrPrices.push({
                strProductId: product.strProductId,
                decPartnerPrice: productPrice.decPartnerPrice,
                bHasCustomPrice: productPrice.bHasCustomPrice
              });
            }
          }
        }
        
        setArrPartnerPrices(arrPrices);
      } catch (error) {
        setStrError('Error loading partner prices');
      } finally {
        setIsLoading(false);
      }
    };

    fnLoadPartnerPrices();
  }, [product.strProductId, partners]);

  const fnUpdatePartnerPrice = async (strPartnerId: string, decPartnerPrice: number) => {
    try {
      setIsSaving(true);
      
      const response = await fetch(`/api/partners/${strPartnerId}/prices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          arrPrices: [{
            strProductId: product.strProductId,
            decPartnerPrice: decPartnerPrice
          }]
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Update local state
        setArrPartnerPrices(prev => 
          prev.map(price => 
            price.strProductId === product.strProductId 
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

  const fnResetToBasePrice = async (strPartnerId: string) => {
    await fnUpdatePartnerPrice(strPartnerId, product.decBasePrice);
  };

  if (bIsLoading) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading partner pricing...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Partner Pricing for: {product.strProductName}
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

          <div className="mb-4">
            <p className="text-sm text-gray-600">
              Base Price: <span className="font-semibold">${product.decBasePrice.toFixed(2)}</span>
            </p>
            <p className="text-sm text-gray-600">
              Set custom prices for each partner. Leave empty to use base price.
            </p>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {partners.map((partner) => {
              const partnerPrice = arrPartnerPrices.find(p => p.strProductId === product.strProductId);
              const currentPrice = partnerPrice?.decPartnerPrice || product.decBasePrice;
              const hasCustomPrice = partnerPrice?.bHasCustomPrice || false;

              return (
                <div key={partner.strPartnerId} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{partner.strPartnerName}</h4>
                      <p className="text-sm text-gray-500">{partner.strPartnerCode}</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Current Price:</p>
                        <p className={`font-semibold ${hasCustomPrice ? 'text-green-600' : 'text-gray-900'}`}>
                          ${currentPrice.toFixed(2)}
                        </p>
                        {hasCustomPrice && (
                          <p className="text-xs text-green-600">Custom Price</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={product.decBasePrice.toFixed(2)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                          onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            if (!isNaN(value) && value > 0) {
                              fnUpdatePartnerPrice(partner.strPartnerId, value);
                            }
                          }}
                        />
                        <button
                          onClick={() => fnResetToBasePrice(partner.strPartnerId)}
                          className="text-xs text-gray-500 hover:text-gray-700"
                          title="Reset to base price"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

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