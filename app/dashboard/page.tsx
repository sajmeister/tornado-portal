'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fnGetRoleDisplayName, fnGetRoleDescription, fnGetRolePermissions, fnHasPermission } from '../../src/lib/roles';
import CmpHeader from '../components/CmpHeader';
import CmpAnalytics from '../components/CmpAnalytics';

interface IUser {
  strUserId: string;
  strUsername: string;
  strEmail: string;
  strName: string;
  strRole: string;
  strAvatarUrl?: string;
}

export default function DashboardPage() {
  const [objUser, setObjUser] = useState<IUser | null>(null);
  const [bIsLoading, setBIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Get user info from the server
    fetch('/api/auth/me')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          setObjUser(data.user);
        } else {
          router.push('/login');
        }
      })
      .catch(() => {
        router.push('/login');
      })
      .finally(() => {
        setBIsLoading(false);
      });
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (bIsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!objUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CmpHeader objUser={objUser} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                User Information
              </h2>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Username</dt>
                  <dd className="mt-1 text-sm text-gray-900">{objUser.strUsername}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">{objUser.strEmail}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{objUser.strName}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Role</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {fnGetRoleDisplayName(objUser.strRole)}
                    <p className="text-xs text-gray-500 mt-1">
                      {fnGetRoleDescription(objUser.strRole)}
                    </p>
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="mt-6 bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Role Permissions
              </h2>
              <div className="grid grid-cols-1 gap-2">
                {fnGetRolePermissions(objUser.strRole).map((permission, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                    <div>
                      <span className="text-sm font-medium text-gray-900">{permission.strDescription}</span>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Granted
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Quick Actions
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* Products - only visible if user has product:manage or product:view permission */}
                {(fnHasPermission(objUser.strRole, 'product:manage') || fnHasPermission(objUser.strRole, 'product:view')) && (
                  <button 
                    onClick={() => router.push('/products')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-md text-sm font-medium"
                  >
                    Manage Products
                  </button>
                )}
                
                {/* Quotes - only visible if user has quote:manage, quote:view, or quote:create permission */}
                {(fnHasPermission(objUser.strRole, 'quote:manage') || fnHasPermission(objUser.strRole, 'quote:view') || fnHasPermission(objUser.strRole, 'quote:create')) && (
                  <button 
                    onClick={() => router.push('/quotes')}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-md text-sm font-medium"
                  >
                    Manage Quotes
                  </button>
                )}
                
                {/* Orders - only visible if user has order:manage or order:view permission */}
                {(fnHasPermission(objUser.strRole, 'order:manage') || fnHasPermission(objUser.strRole, 'order:view')) && (
                  <button 
                    onClick={() => router.push('/orders')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-md text-sm font-medium"
                  >
                    View Orders
                  </button>
                )}
                
                {/* Roles - only visible if user has user:manage permission (Super Admin) */}
                {fnHasPermission(objUser.strRole, 'user:manage') && (
                  <button 
                    onClick={() => router.push('/roles')}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-md text-sm font-medium"
                  >
                    View Roles
                  </button>
                )}
                
                {/* Partners - only visible if user has partner:manage or partner:view permission */}
                {(fnHasPermission(objUser.strRole, 'partner:manage') || fnHasPermission(objUser.strRole, 'partner:view')) && (
                  <button 
                    onClick={() => router.push('/partners')}
                    className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-3 rounded-md text-sm font-medium"
                  >
                    View Partners
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Analytics Section */}
          <div className="mt-6">
            <CmpAnalytics objUser={objUser} />
          </div>
        </div>
      </main>
    </div>
  );
} 