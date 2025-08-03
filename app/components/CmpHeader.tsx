'use client';

import { useRouter } from 'next/navigation';
import { fnHasPermission } from '../../src/lib/roles';
import CmpNotifications from './CmpNotifications';

interface IUser {
  strUserId: string;
  strUsername: string;
  strEmail: string;
  strName: string;
  strRole: string;
  strAvatarUrl?: string;
}

interface CmpHeaderProps {
  objUser: IUser | null;
  onLogout: () => void;
}

export default function CmpHeader({ objUser, onLogout }: CmpHeaderProps) {
  const router = useRouter();

  return (
    <div className="bg-repeat-x relative" style={{ backgroundImage: 'url(/bgbar.JPG)' }}>
      {/* Top header with SVG logo and logout button */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center items-center h-20 relative">
          {/* Logo section - always centered */}
          <div className="flex items-center space-x-3">
            <span className="text-3xl font-bold text-white tracking-tight select-none">
              tornado
            </span>
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10"
            >
              <ellipse cx="24" cy="10" rx="18" ry="6" fill="#ffffff" fillOpacity="0.9"/>
              <ellipse cx="24" cy="18" rx="14" ry="4" fill="#ffffff" fillOpacity="0.7"/>
              <ellipse cx="24" cy="25" rx="10" ry="3" fill="#ffffff" fillOpacity="0.5"/>
              <ellipse cx="24" cy="31" rx="6" ry="2" fill="#ffffff" fillOpacity="0.4"/>
              <path d="M24 33c0 3 2 6 2 6s-2-1-2-3-2 3-2 3 2-3 2-6z" fill="#ffffff" fillOpacity="0.8"/>
            </svg>
          </div>

          {/* Logout button - positioned absolutely on the right */}
          {objUser && (
            <button
              onClick={onLogout}
              className="absolute right-0 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Logout
            </button>
          )}
        </div>
      </div>

      {/* Navigation bar */}
      {objUser && (
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-12">
              <div className="flex items-center space-x-6">
                {/* Dashboard - always visible for logged in users */}
                <button
                  onClick={() => router.push('/dashboard')}
                  className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Dashboard
                </button>
                
                {/* Products - only visible if user has product:manage or product:view permission */}
                {(fnHasPermission(objUser.strRole, 'product:manage') || fnHasPermission(objUser.strRole, 'product:view')) && (
                  <button
                    onClick={() => router.push('/products')}
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Products
                  </button>
                )}
                
                {/* Quotes - only visible if user has quote:manage, quote:view, or quote:create permission */}
                {(fnHasPermission(objUser.strRole, 'quote:manage') || fnHasPermission(objUser.strRole, 'quote:view') || fnHasPermission(objUser.strRole, 'quote:create')) && (
                  <button
                    onClick={() => router.push('/quotes')}
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Quotes
                  </button>
                )}
                
                {/* Orders - only visible if user has order:manage or order:view permission */}
                {(fnHasPermission(objUser.strRole, 'order:manage') || fnHasPermission(objUser.strRole, 'order:view')) && (
                  <button
                    onClick={() => router.push('/orders')}
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Orders
                  </button>
                )}
                
                {/* Roles - only visible if user has user:manage permission (Super Admin) */}
                {fnHasPermission(objUser.strRole, 'user:manage') && (
                  <button
                    onClick={() => router.push('/roles')}
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Roles
                  </button>
                )}
                
                {/* Partners - only visible if user has partner:manage or partner:view permission */}
                {(fnHasPermission(objUser.strRole, 'partner:manage') || fnHasPermission(objUser.strRole, 'partner:view')) && (
                  <button
                    onClick={() => router.push('/partners')}
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    {objUser.strRole === 'partner_admin' || objUser.strRole === 'partner_user' ? 'Your Organization' : 'Partners'}
                  </button>
                )}
                
                {/* Orphaned Users - only visible for Super Admins */}
                {fnHasPermission(objUser.strRole, 'user:manage') && (
                  <button
                    onClick={() => router.push('/users/orphaned')}
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Orphaned Users
                  </button>
                )}
              </div>
              <div className="flex items-center space-x-4">
                <CmpNotifications />
                <span className="text-gray-700 text-sm">
                  Welcome, {objUser.strName}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 