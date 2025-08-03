'use client';

import { useState, useEffect } from 'react';
import { INotification, fnGetNotifications, fnMarkAsRead, fnMarkAllAsRead, fnGetUnreadCount } from '../../src/lib/notifications';

interface CmpNotificationsProps {
  className?: string;
}

export default function CmpNotifications({ className = '' }: CmpNotificationsProps) {
  const [arrNotifications, setArrNotifications] = useState<INotification[]>([]);
  const [bShowNotifications, setBShowNotifications] = useState(false);
  const [intUnreadCount, setIntUnreadCount] = useState(0);

  useEffect(() => {
    const fnUpdateNotifications = () => {
      setArrNotifications(fnGetNotifications());
      setIntUnreadCount(fnGetUnreadCount());
    };

    // Update notifications immediately
    fnUpdateNotifications();

    // Set up interval to check for new notifications
    const interval = setInterval(fnUpdateNotifications, 1000);

    return () => clearInterval(interval);
  }, []);

  const fnHandleMarkAsRead = (strId: string) => {
    fnMarkAsRead(strId);
    setArrNotifications(fnGetNotifications());
    setIntUnreadCount(fnGetUnreadCount());
  };

  const fnHandleMarkAllAsRead = () => {
    fnMarkAllAsRead();
    setArrNotifications(fnGetNotifications());
    setIntUnreadCount(fnGetUnreadCount());
  };

  const fnGetNotificationIcon = (strType: string) => {
    switch (strType) {
      case 'success':
        return (
          <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const fnGetNotificationColor = (strType: string) => {
    switch (strType) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell */}
      <button
        onClick={() => setBShowNotifications(!bShowNotifications)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4.83 2H20a2 2 0 012 2v12a2 2 0 01-2 2H4.83a2 2 0 01-1.66-.89L1.17 13.11A2 2 0 011 12V4a2 2 0 012-2z" />
        </svg>
        
        {/* Unread Badge */}
        {intUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {intUnreadCount > 99 ? '99+' : intUnreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown */}
      {bShowNotifications && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              {intUnreadCount > 0 && (
                <button
                  onClick={fnHandleMarkAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Mark all as read
                </button>
              )}
            </div>
          </div>
          
          <div className="p-2">
            {arrNotifications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4.83 2H20a2 2 0 012 2v12a2 2 0 01-2 2H4.83a2 2 0 01-1.66-.89L1.17 13.11A2 2 0 011 12V4a2 2 0 012-2z" />
                </svg>
                <p>No notifications</p>
              </div>
            ) : (
              <div className="space-y-2">
                {arrNotifications.map((objNotification) => (
                  <div
                    key={objNotification.strId}
                    className={`p-3 rounded-lg border ${fnGetNotificationColor(objNotification.strType)} ${
                      !objNotification.bIsRead ? 'ring-2 ring-blue-200' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        {fnGetNotificationIcon(objNotification.strType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className={`text-sm font-medium ${
                              objNotification.bIsRead ? 'text-gray-600' : 'text-gray-900'
                            }`}>
                              {objNotification.strTitle}
                            </p>
                            <p className={`text-sm ${
                              objNotification.bIsRead ? 'text-gray-500' : 'text-gray-700'
                            }`}>
                              {objNotification.strMessage}
                            </p>
                          </div>
                          {!objNotification.bIsRead && (
                            <button
                              onClick={() => fnHandleMarkAsRead(objNotification.strId)}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(objNotification.dtCreated).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {bShowNotifications && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setBShowNotifications(false)}
        />
      )}
    </div>
  );
} 