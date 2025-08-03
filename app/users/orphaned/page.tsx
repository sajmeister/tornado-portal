'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CmpHeader from '../../components/CmpHeader';

interface IUser {
  strUserId: string;
  strUsername: string;
  strEmail: string;
  strName: string;
  strRole: string;
  bIsActive: boolean;
  dtCreated: string;
  dtUpdated: string;
}

export default function OrphanedUsersPage() {
  const [arrOrphanedUsers, setArrOrphanedUsers] = useState<IUser[]>([]);
  const [objUser, setObjUser] = useState<IUser | null>(null);
  const [bIsLoading, setIsLoading] = useState(true);
  const [strError, setStrError] = useState('');
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const fnLoadOrphanedUsers = async () => {
    try {
      const objResponse = await fetch('/api/users/orphaned', {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const objData = await objResponse.json();
      
      if (objData.success) {
        setArrOrphanedUsers(objData.users);
      } else {
        setStrError(objData.error || 'Failed to load orphaned users');
      }
    } catch (error) {
      console.error('Error loading orphaned users:', error);
      setStrError('Failed to load orphaned users');
    }
  };

  const fnFormatDate = (strDate: string): string => {
    return new Date(strDate).toLocaleDateString();
  };

  const fnGetRoleDisplayName = (strRole: string): string => {
    return strRole.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const fnHandleDeleteUser = async (strUserId: string, strUserName: string, strUserRole: string) => {
    // Check if this is the last Super Admin trying to be deleted
    if (strUserRole === 'super_admin') {
      const arrOtherSuperAdmins = arrOrphanedUsers.filter(user => 
        user.strRole === 'super_admin' && user.strUserId !== strUserId
      );
      
      if (arrOtherSuperAdmins.length === 0) {
        alert('Cannot delete the last Super Admin. At least one Super Admin must remain in the system.');
        return;
      }
    }

    if (!confirm(`Are you sure you want to delete the user account for ${strUserName}? This action cannot be undone and will permanently remove the user from the system.`)) {
      return;
    }

    try {
      const objResponse = await fetch(`/api/users/${strUserId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const objData = await objResponse.json();

      if (objData.success) {
        // Refresh the orphaned users list
        await fnLoadOrphanedUsers();
        // Show success message (you could add a toast notification here)
        alert(objData.message);
      } else {
        setStrError(objData.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      setStrError('Failed to delete user');
    }
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

        // Check if user is Super Admin
        if (objCurrentUser.strRole !== 'super_admin') {
          setStrError('Access denied. Only Super Admins can view orphaned users.');
          setIsLoading(false);
          return;
        }

        // Load orphaned users
        await fnLoadOrphanedUsers();

      } catch (error) {
        console.error('Error loading data:', error);
        setStrError('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    fnLoadData();
  }, [router]);

  if (bIsLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <CmpHeader objUser={objUser} onLogout={handleLogout} />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="flex justify-center items-center h-64">
              <div className="text-lg text-gray-600">Loading orphaned users...</div>
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
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Orphaned Users
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Users who are not associated with any partner organization
            </p>
          </div>

          {/* Orphaned Users List */}
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            {arrOrphanedUsers.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No orphaned users found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  All users are currently associated with partner organizations.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {arrOrphanedUsers.map((objOrphanedUser) => (
                  <li key={objOrphanedUser.strUserId} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900 truncate">
                              {objOrphanedUser.strName}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {objOrphanedUser.strEmail} • {objOrphanedUser.strUsername}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-900 capitalize">
                              {fnGetRoleDisplayName(objOrphanedUser.strRole)}
                            </div>
                            <div className="text-sm text-gray-500">
                              Created {fnFormatDate(objOrphanedUser.dtCreated)}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="ml-4 flex-shrink-0 flex space-x-2">
                        <button
                          onClick={() => router.push('/partners')}
                          className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                        >
                          Assign to Partner
                        </button>
                        {/* Only show Delete button if user is not deleting themselves */}
                        {objUser && objUser.strUserId !== objOrphanedUser.strUserId && (
                                                     <button
                             onClick={() => fnHandleDeleteUser(objOrphanedUser.strUserId, objOrphanedUser.strName, objOrphanedUser.strRole)}
                             className="text-red-600 hover:text-red-900 text-sm font-medium"
                           >
                            Delete User
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 