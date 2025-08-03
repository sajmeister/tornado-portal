'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import CmpHeader from '../../../components/CmpHeader';

interface IPartnerUser {
  strPartnerUserId: string;
  strUserId: string;
  strPartnerId: string;
  strRole: string;
  dtCreated: string;
  dtUpdated: string;
  bIsActive: boolean;
  // User details
  strUsername: string;
  strEmail: string;
  strName: string;
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
  decDiscountRate: number;
}

export default function PartnerUsersPage() {
  const [arrPartnerUsers, setArrPartnerUsers] = useState<IPartnerUser[]>([]);
  const [objUser, setObjUser] = useState<IUser | null>(null);
  const [objPartner, setObjPartner] = useState<IPartner | null>(null);
  const [bIsLoading, setIsLoading] = useState(true);
  const [strError, setStrError] = useState('');
  const [bShowAddUserModal, setShowAddUserModal] = useState(false);
  const [strSelectedUserId, setSelectedUserId] = useState('');
  const [strSelectedRole, setSelectedRole] = useState('partner_user');
  const router = useRouter();
  const params = useParams();
  const strPartnerId = params.partnerId as string;

  // Check if user has permission to manage partner users
  const fnCanManagePartnerUsers = (strRole: string): boolean => {
    return ['super_admin', 'partner_admin'].includes(strRole);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const fnLoadPartnerUsers = async () => {
    try {
      const objResponse = await fetch(`/api/partners/${strPartnerId}/users`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const objData = await objResponse.json();
      
      if (objData.success) {
        setArrPartnerUsers(objData.users);
      } else {
        setStrError(objData.error || 'Failed to load partner users');
      }
    } catch (error) {
      console.error('Error loading partner users:', error);
      setStrError('Failed to load partner users');
    }
  };

  const fnLoadPartner = async () => {
    try {
      const objResponse = await fetch(`/api/partners/${strPartnerId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const objData = await objResponse.json();
      
      if (objData.success) {
        setObjPartner(objData.partner);
      } else {
        setStrError(objData.error || 'Failed to load partner');
      }
    } catch (error) {
      console.error('Error loading partner:', error);
      setStrError('Failed to load partner');
    }
  };

  const fnHandleAddUser = async () => {
    try {
      const objResponse = await fetch(`/api/partners/${strPartnerId}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          strUserId: strSelectedUserId,
          strRole: strSelectedRole,
        }),
      });

      const objData = await objResponse.json();

      if (objData.success) {
        setShowAddUserModal(false);
        setSelectedUserId('');
        setSelectedRole('partner_user');
        fnLoadPartnerUsers(); // Refresh the list
      } else {
        setStrError(objData.error || 'Failed to add user to partner');
      }
    } catch (error) {
      console.error('Error adding user to partner:', error);
      setStrError('Failed to add user to partner');
    }
  };

  const fnHandleRemoveUser = async (strPartnerUserId: string) => {
    if (!confirm('Are you sure you want to remove this user from the partner?')) {
      return;
    }

    try {
      const objResponse = await fetch(`/api/partners/${strPartnerId}/users/${strPartnerUserId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const objData = await objResponse.json();

      if (objData.success) {
        fnLoadPartnerUsers(); // Refresh the list
      } else {
        setStrError(objData.error || 'Failed to remove user from partner');
      }
    } catch (error) {
      console.error('Error removing user from partner:', error);
      setStrError('Failed to remove user from partner');
    }
  };

  const fnFormatDate = (strDate: string): string => {
    return new Date(strDate).toLocaleDateString();
  };

  useEffect(() => {
    const fnLoadData = async () => {
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
        if (!fnCanManagePartnerUsers(objCurrentUser.strRole)) {
          setStrError('Access denied. You do not have permission to manage partner users.');
          setIsLoading(false);
          return;
        }

        // Load partner and partner users
        await Promise.all([
          fnLoadPartner(),
          fnLoadPartnerUsers()
        ]);

      } catch (error) {
        console.error('Error loading data:', error);
        setStrError('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    fnLoadData();
  }, [router, strPartnerId]);

  if (bIsLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <CmpHeader objUser={objUser} onLogout={handleLogout} />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="flex justify-center items-center h-64">
              <div className="text-lg text-gray-600">Loading partner users...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (strError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <CmpHeader objUser={objUser} onLogout={handleLogout} />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">{strError}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CmpHeader objUser={objUser} onLogout={handleLogout} />
      
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Page Header */}
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Partner Users - {objPartner?.strPartnerName}
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Manage users for partner organization
              </p>
            </div>
            
            {/* Add User Button */}
            {objUser && fnCanManagePartnerUsers(objUser.strRole) && (
              <button
                onClick={() => setShowAddUserModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Add User
              </button>
            )}
          </div>

          {/* Partner Users List */}
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            {arrPartnerUsers.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Get started by adding users to this partner organization.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {arrPartnerUsers.map((objPartnerUser) => (
                  <li key={objPartnerUser.strPartnerUserId} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900 truncate">
                              {objPartnerUser.strName}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {objPartnerUser.strEmail}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-900 capitalize">
                              {objPartnerUser.strRole.replace('_', ' ')}
                            </div>
                            <div className="text-sm text-gray-500">
                              Added {fnFormatDate(objPartnerUser.dtCreated)}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      {objUser && fnCanManagePartnerUsers(objUser.strRole) && (
                        <div className="ml-4 flex-shrink-0">
                          <button
                            onClick={() => fnHandleRemoveUser(objPartnerUser.strPartnerUserId)}
                            className="text-red-600 hover:text-red-900 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {bShowAddUserModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add User to Partner</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">User ID</label>
                  <input
                    type="text"
                    value={strSelectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="Enter user ID"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role</label>
                  <select
                    value={strSelectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="partner_user">Partner User</option>
                    <option value="partner_admin">Partner Admin</option>
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddUserModal(false);
                    setSelectedUserId('');
                    setSelectedRole('partner_user');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={fnHandleAddUser}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  Add User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 