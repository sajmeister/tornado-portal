'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CmpHeader from '../components/CmpHeader';
import { fnHasPermission } from '../../src/lib/roles';

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
  decDiscountRate: number;
  dtCreated: string;
  dtUpdated: string;
  bIsActive: boolean;
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

interface IPartnerFormData {
  strPartnerName: string;
  strPartnerCode: string;
  strContactEmail: string;
  strContactPhone: string;
  strAddress: string;
  strCity: string;
  strState: string;
  strCountry: string;
  strPostalCode: string;
  decDiscountRate: number;
}

export default function PartnersPage() {
  const [arrPartners, setArrPartners] = useState<IPartner[]>([]);
  const [objUser, setObjUser] = useState<IUser | null>(null);
  const [bIsLoading, setIsLoading] = useState(true);
  const [strError, setStrError] = useState('');
  const [bShowCreateModal, setShowCreateModal] = useState(false);
  const [bShowEditModal, setShowEditModal] = useState(false);
  const [objEditingPartner, setEditingPartner] = useState<IPartner | null>(null);
  const [objFormData, setFormData] = useState<IPartnerFormData>({
    strPartnerName: '',
    strPartnerCode: '',
    strContactEmail: '',
    strContactPhone: '',
    strAddress: '',
    strCity: '',
    strState: '',
    strCountry: '',
    strPostalCode: '',
    decDiscountRate: 0,
  });
  const [strUserPartnerId, setUserPartnerId] = useState<string | null>(null);
  const router = useRouter();

  // Check if user has permission to view partners
  const fnCanViewPartners = (strRole: string): boolean => {
    return ['super_admin', 'provider_user', 'partner_admin'].includes(strRole);
  };

  // Check if user can manage partners (create/edit/delete)
  const fnCanManagePartners = (strRole: string): boolean => {
    return ['super_admin'].includes(strRole);
  };

  // Check if user can manage users for a specific partner
  const fnCanManagePartnerUsers = (strRole: string, strPartnerId: string): boolean => {
    console.log('Checking permissions:', { strRole, strPartnerId, strUserPartnerId });
    if (!fnHasPermission(strRole, 'user:manage_partner')) return false;
    if (strRole === 'super_admin') return true;
    if (strRole === 'partner_admin' && strUserPartnerId === strPartnerId) return true;
    return false;
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const fnLoadPartners = async () => {
    try {
      const objPartnersResponse = await fetch('/api/partners', {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const objPartnersData = await objPartnersResponse.json();
      
      if (objPartnersData.success) {
        setArrPartners(objPartnersData.partners);
      } else {
        setStrError(objPartnersData.error || 'Failed to load partners');
      }
    } catch (error) {
      console.error('Error loading partners:', error);
      setStrError('Failed to load partners');
    }
  };

  const fnLoadUserPartnerInfo = async () => {
    if (!objUser || objUser.strRole !== 'partner_admin') return;
    
    try {
      const objResponse = await fetch('/api/auth/me/partner', {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const objData = await objResponse.json();
      
      if (objData.success && objData.partner) {
        console.log('Setting user partner ID:', objData.partner.strPartnerId);
        setUserPartnerId(objData.partner.strPartnerId);
      }
    } catch (error) {
      console.error('Error loading user partner info:', error);
    }
  };

  const fnHandleCreatePartner = () => {
    setFormData({
      strPartnerName: '',
      strPartnerCode: '',
      strContactEmail: '',
      strContactPhone: '',
      strAddress: '',
      strCity: '',
      strState: '',
      strCountry: '',
      strPostalCode: '',
      decDiscountRate: 0,
    });
    setShowCreateModal(true);
  };

  const fnHandleEditPartner = (objPartner: IPartner) => {
    setFormData({
      strPartnerName: objPartner.strPartnerName,
      strPartnerCode: objPartner.strPartnerCode,
      strContactEmail: objPartner.strContactEmail,
      strContactPhone: objPartner.strContactPhone || '',
      strAddress: objPartner.strAddress || '',
      strCity: objPartner.strCity || '',
      strState: objPartner.strState || '',
      strCountry: objPartner.strCountry || '',
      strPostalCode: objPartner.strPostalCode || '',
      decDiscountRate: objPartner.decDiscountRate,
    });
    setEditingPartner(objPartner);
    setShowEditModal(true);
  };

  const fnHandleSubmitPartner = async (bIsEdit: boolean = false) => {
    try {
      const strUrl = bIsEdit ? `/api/partners/${objEditingPartner?.strPartnerId}` : '/api/partners';
      const strMethod = bIsEdit ? 'PUT' : 'POST';

      const objResponse = await fetch(strUrl, {
        method: strMethod,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(objFormData),
      });

      const objData = await objResponse.json();

      if (objData.success) {
        setShowCreateModal(false);
        setShowEditModal(false);
        setEditingPartner(null);
        fnLoadPartners(); // Refresh the list
      } else {
        setStrError(objData.error || 'Failed to save partner');
      }
    } catch (error) {
      console.error('Error saving partner:', error);
      setStrError('Failed to save partner');
    }
  };

  const fnHandleInputChange = (strField: keyof IPartnerFormData, strValue: string | number) => {
    setFormData(prev => ({
      ...prev,
      [strField]: strValue,
    }));
  };

  useEffect(() => {
    const fnLoadUserAndPartners = async () => {
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
        if (!fnCanViewPartners(objCurrentUser.strRole)) {
          setStrError('Access denied. You do not have permission to view partners.');
          setIsLoading(false);
          return;
        }

        // Load partners
        await fnLoadPartners();

        // Load user partner info for Partner Admins
        await fnLoadUserPartnerInfo();

      } catch (error) {
        console.error('Error loading partners:', error);
        setStrError('Failed to load partners');
      } finally {
        setIsLoading(false);
      }
    };

    fnLoadUserAndPartners();
  }, [router]);

  // Load user partner info when user state changes
  useEffect(() => {
    if (objUser && objUser.strRole === 'partner_admin') {
      fnLoadUserPartnerInfo();
    }
  }, [objUser]);

  const fnFormatDate = (strDate: string): string => {
    return new Date(strDate).toLocaleDateString();
  };

  const fnFormatCurrency = (decAmount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(decAmount);
  };

  if (bIsLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <CmpHeader objUser={objUser} onLogout={handleLogout} />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="flex justify-center items-center h-64">
              <div className="text-lg text-gray-600">Loading partners...</div>
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
                {objUser?.strRole === 'partner_admin' || objUser?.strRole === 'partner_customer' ? 'Your Organization' : 'Partners'}
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                {objUser?.strRole === 'partner_admin' || objUser?.strRole === 'partner_customer' 
                  ? 'Manage your organization and settings'
                  : 'Manage partner organizations and their settings'
                }
              </p>
            </div>
            
            {/* Create Partner Button - Only for Super Admin */}
            {objUser && fnCanManagePartners(objUser.strRole) && (
              <button
                onClick={fnHandleCreatePartner}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Create Partner
              </button>
            )}
          </div>

          {/* Partners List */}
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            {arrPartners.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No partners found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {objUser?.strRole === 'super_admin' 
                    ? 'Get started by creating a new partner organization.'
                    : 'No partner organizations are currently available.'
                  }
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {arrPartners.map((objPartner) => (
                  <li key={objPartner.strPartnerId} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900 truncate">
                              {objPartner.strPartnerName}
                            </h3>
                            <p className="text-sm text-gray-500">
                              Code: {objPartner.strPartnerCode}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-900">
                              {objPartner.decDiscountRate}% Discount
                            </div>
                            <div className="text-sm text-gray-500">
                              Partner since {fnFormatDate(objPartner.dtCreated)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Email:</span> {objPartner.strContactEmail}
                          </div>
                          {objPartner.strContactPhone && (
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Phone:</span> {objPartner.strContactPhone}
                            </div>
                          )}
                          {objPartner.strAddress && (
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Address:</span> {objPartner.strAddress}
                            </div>
                          )}
                          {objPartner.strCity && objPartner.strState && (
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Location:</span> {objPartner.strCity}, {objPartner.strState}
                            </div>
                          )}
                          {objPartner.strCountry && (
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Country:</span> {objPartner.strCountry}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      {objUser && (
                        <div className="ml-4 flex-shrink-0 flex space-x-2">
                          {/* Edit button - Only for Super Admin */}
                          {fnCanManagePartners(objUser.strRole) && (
                            <button
                              onClick={() => fnHandleEditPartner(objPartner)}
                              className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                            >
                              Edit
                            </button>
                          )}
                          
                          {/* Manage Users button - For Super Admin and Partner Admin (own partner) */}
                          {fnCanManagePartnerUsers(objUser.strRole, objPartner.strPartnerId) && (
                            <button
                              onClick={() => router.push(`/partners/${objPartner.strPartnerId}/users`)}
                              className="text-green-600 hover:text-green-900 text-sm font-medium"
                            >
                              Manage Users
                            </button>
                          )}
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

      {/* Create Partner Modal */}
      {bShowCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Partner</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Partner Name *</label>
                  <input
                    type="text"
                    value={objFormData.strPartnerName}
                    onChange={(e) => fnHandleInputChange('strPartnerName', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Partner Code *</label>
                  <input
                    type="text"
                    value={objFormData.strPartnerCode}
                    onChange={(e) => fnHandleInputChange('strPartnerCode', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Contact Email *</label>
                  <input
                    type="email"
                    value={objFormData.strContactEmail}
                    onChange={(e) => fnHandleInputChange('strContactEmail', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Contact Phone</label>
                  <input
                    type="tel"
                    value={objFormData.strContactPhone}
                    onChange={(e) => fnHandleInputChange('strContactPhone', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Discount Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={objFormData.decDiscountRate}
                    onChange={(e) => fnHandleInputChange('decDiscountRate', parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={() => fnHandleSubmitPartner(false)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  Create Partner
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Partner Modal */}
      {bShowEditModal && objEditingPartner && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Partner</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Partner Name *</label>
                  <input
                    type="text"
                    value={objFormData.strPartnerName}
                    onChange={(e) => fnHandleInputChange('strPartnerName', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Partner Code *</label>
                  <input
                    type="text"
                    value={objFormData.strPartnerCode}
                    onChange={(e) => fnHandleInputChange('strPartnerCode', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Contact Email *</label>
                  <input
                    type="email"
                    value={objFormData.strContactEmail}
                    onChange={(e) => fnHandleInputChange('strContactEmail', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Contact Phone</label>
                  <input
                    type="tel"
                    value={objFormData.strContactPhone}
                    onChange={(e) => fnHandleInputChange('strContactPhone', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Discount Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={objFormData.decDiscountRate}
                    onChange={(e) => fnHandleInputChange('decDiscountRate', parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingPartner(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={() => fnHandleSubmitPartner(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  Update Partner
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 