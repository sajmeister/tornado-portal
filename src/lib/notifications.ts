export interface INotification {
  strId: string;
  strType: 'success' | 'error' | 'info' | 'warning';
  strTitle: string;
  strMessage: string;
  dtCreated: Date;
  bIsRead: boolean;
}

// Simple in-memory notification store (in a real app, this would be in a database)
let arrNotifications: INotification[] = [];

export const fnAddNotification = (objNotification: Omit<INotification, 'strId' | 'dtCreated' | 'bIsRead'>): void => {
  const strId = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const objNewNotification: INotification = {
    ...objNotification,
    strId,
    dtCreated: new Date(),
    bIsRead: false,
  };
  
  arrNotifications.unshift(objNewNotification);
  
  // Keep only the last 50 notifications
  if (arrNotifications.length > 50) {
    arrNotifications = arrNotifications.slice(0, 50);
  }
};

export const fnGetNotifications = (): INotification[] => {
  return [...arrNotifications];
};

export const fnMarkAsRead = (strId: string): void => {
  const objNotification = arrNotifications.find(n => n.strId === strId);
  if (objNotification) {
    objNotification.bIsRead = true;
  }
};

export const fnMarkAllAsRead = (): void => {
  arrNotifications.forEach(n => n.bIsRead = true);
};

export const fnGetUnreadCount = (): number => {
  return arrNotifications.filter(n => !n.bIsRead).length;
};

export const fnClearNotifications = (): void => {
  arrNotifications = [];
};

// Helper functions for common notification types
export const fnNotifyOrderStatusChange = (strOrderNumber: string, strOldStatus: string, strNewStatus: string): void => {
  fnAddNotification({
    strType: 'info',
    strTitle: 'Order Status Updated',
    strMessage: `Order ${strOrderNumber} status changed from ${strOldStatus} to ${strNewStatus}`,
  });
};

export const fnNotifyOrderCreated = (strOrderNumber: string, strPartnerName: string): void => {
  fnAddNotification({
    strType: 'success',
    strTitle: 'New Order Created',
    strMessage: `Order ${strOrderNumber} has been created for ${strPartnerName}`,
  });
};

export const fnNotifyQuoteConverted = (strQuoteNumber: string, strOrderNumber: string): void => {
  fnAddNotification({
    strType: 'success',
    strTitle: 'Quote Converted to Order',
    strMessage: `Quote ${strQuoteNumber} has been successfully converted to Order ${strOrderNumber}`,
  });
};

export const fnNotifyError = (strTitle: string, strMessage: string): void => {
  fnAddNotification({
    strType: 'error',
    strTitle,
    strMessage,
  });
}; 