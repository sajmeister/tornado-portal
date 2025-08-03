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
  decPartnerPrice: number;
  decDiscountRate?: number;
  strCategory: string;
  intStockQuantity?: number;
  strDependencyId?: string; // Product ID that this product depends on
  bIsActive: boolean;
  dtCreated: string;
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
  const [objUser, setObjUser] = useState<IUser | null>(null);
  const [bIsLoading, setIsLoading] = useState(true);
  const [bIsCreating, setIsCreating] = useState(false);
  const [bIsEditing, setIsEditing] = useState(false);
  const [objEditingProduct, setObjEditingProduct] = useState<IProduct | null>(null);
  const [strError, setStrError] = useState('');
  const router = useRouter();

  // Check if user has permission to manage products
  const fnCanManageProducts = (strRole: string): boolean => {
    return fnHasPermission(strRole, 'product:manage');
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
    const fnLoadUserAndProducts = async () => {
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
        if (!fnCanManageProducts(objCurrentUser.strRole)) {
          setStrError('Access denied. Only Super Admin and Provider User roles can manage products.');
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
      } catch (error) {
        setStrError('Error loading data');
      } finally {
        setIsLoading(false);
      }
    };

    fnLoadUserAndProducts();
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

  if (strError && !fnCanManageProducts(objUser?.strRole || '')) {
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
          <h1 className="text-3xl font-bold text-gray-900">Product Catalog Management</h1>
          <p className="text-gray-600 mt-2">
            Manage products for the Tornado Portal. Only Super Admin and Provider User roles can access this page.
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

        {/* Create Product Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Create New Product</h2>
          <CreateProductForm 
            products={fnGetAvailableDependencies()}
            onSubmit={fnCreateProduct} 
            isLoading={bIsCreating} 
          />
        </div>

        {/* Products List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Products ({arrProducts.length})</h2>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dependency
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
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
                      <div>Base: ${objProduct.decBasePrice.toFixed(2)}</div>
                      <div className="text-blue-600">Partner: ${objProduct.decPartnerPrice.toFixed(2)}</div>
                      {objProduct.decDiscountRate && (
                        <div className="text-xs text-green-600">
                          {objProduct.decDiscountRate}% discount
                        </div>
                      )}
                    </td>
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        objProduct.bIsActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {objProduct.bIsActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Product Modal */}
      {bIsEditing && objEditingProduct && (
        <EditProductModal
          product={objEditingProduct}
          products={fnGetAvailableDependencies(objEditingProduct.strProductId)}
          onSave={fnUpdateProduct}
          onClose={fnCloseEditModal}
          isLoading={bIsEditing}
        />
      )}
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
      decPartnerPrice: parseFloat(decBasePrice), // Will be calculated by API
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