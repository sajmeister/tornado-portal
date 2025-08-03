'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fnGetAllRoles, fnGetRoleDisplayName, fnGetRoleDescription } from '../../src/lib/roles';
import CmpHeader from '../components/CmpHeader';

interface IRoleData {
  strRole: string;
  strDisplayName: string;
  strDescription: string;
  arrPermissions: Array<{
    strPermission: string;
    strDescription: string;
    bIsGranted: boolean;
  }>;
}

export default function RolesPage() {
  const [arrRoles, setArrRoles] = useState<IRoleData[]>([]);
  const [objUser, setObjUser] = useState<any>(null);
  const [bIsLoading, setBIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Get user info and roles from the server
    Promise.all([
      fetch('/api/auth/me').then(response => response.json()),
      fetch('/api/roles').then(response => response.json())
    ])
      .then(([userData, rolesData]) => {
        if (userData.success) {
          setObjUser(userData.user);
        } else {
          router.push('/login');
          return;
        }
        
        if (rolesData.success) {
          setArrRoles(rolesData.data);
        }
      })
      .catch(error => {
        console.error('Error fetching data:', error);
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
        <div className="text-lg">Loading roles...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CmpHeader objUser={objUser} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Role System Overview
            </h2>
            <p className="text-gray-600">
              The Tornado Portal uses a hierarchical role-based access control (RBAC) system with five distinct roles.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {arrRoles.map((objRole) => (
              <div key={objRole.strRole} className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {objRole.strDisplayName}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {objRole.strDescription}
                      </p>
                    </div>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      {objRole.strRole}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-900">Permissions:</h4>
                    <div className="space-y-2">
                      {objRole.arrPermissions.map((permission, index) => (
                        <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md">
                          <span className="text-sm text-gray-700">{permission.strDescription}</span>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Granted
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-500">
                      <strong>Total Permissions:</strong> {objRole.arrPermissions.length}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Role Hierarchy
              </h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Super Admin</div>
                    <div className="text-xs text-gray-500">Can manage all roles and users</div>
                  </div>
                  <div className="text-gray-400">↓</div>
                </div>
                <div className="flex items-center space-x-4 ml-4">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Provider User</div>
                    <div className="text-xs text-gray-500">Can manage products and orders</div>
                  </div>
                  <div className="text-gray-400">↓</div>
                </div>
                <div className="flex items-center space-x-4 ml-8">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Partner Admin</div>
                    <div className="text-xs text-gray-500">Can manage partner users and quotes</div>
                  </div>
                  <div className="text-gray-400">↓</div>
                </div>
                <div className="flex items-center space-x-4 ml-12">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Partner User</div>
                    <div className="text-xs text-gray-500">Can create quotes and view orders</div>
                  </div>
                  <div className="text-gray-400">↓</div>
                </div>
                <div className="flex items-center space-x-4 ml-16">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">End User</div>
                    <div className="text-xs text-gray-500">Basic quote and order access</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 