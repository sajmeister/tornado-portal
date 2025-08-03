// Role definitions and permissions for Tornado Portal

export enum EUserRole {
  SUPER_ADMIN = 'super_admin',
  PROVIDER_USER = 'provider_user',
  PARTNER_ADMIN = 'partner_admin',
  PARTNER_CUSTOMER = 'partner_customer'
}

export interface IRolePermission {
  strPermission: string;
  strDescription: string;
  bIsGranted: boolean;
}

export interface IRoleDefinition {
  strRole: EUserRole;
  strDisplayName: string;
  strDescription: string;
  arrPermissions: IRolePermission[];
}

// Role definitions with permissions
export const objRoleDefinitions: Record<EUserRole, IRoleDefinition> = {
  [EUserRole.SUPER_ADMIN]: {
    strRole: EUserRole.SUPER_ADMIN,
    strDisplayName: 'Super Admin',
    strDescription: 'Full system access with all permissions',
    arrPermissions: [
      { strPermission: 'user:manage', strDescription: 'Manage all users (system-wide)', bIsGranted: true },
      { strPermission: 'user:manage_partner', strDescription: 'Manage users within partner organizations', bIsGranted: true },
      { strPermission: 'partner:manage', strDescription: 'Manage all partners', bIsGranted: true },
      { strPermission: 'product:manage', strDescription: 'Manage all products', bIsGranted: true },
      { strPermission: 'quote:manage', strDescription: 'Manage all quotes', bIsGranted: true },
      { strPermission: 'order:manage', strDescription: 'Manage all orders', bIsGranted: true },
      { strPermission: 'system:admin', strDescription: 'System administration', bIsGranted: true },
      { strPermission: 'reports:view', strDescription: 'View all reports', bIsGranted: true },
      { strPermission: 'analytics:view', strDescription: 'View analytics', bIsGranted: true },
    ]
  },
  [EUserRole.PROVIDER_USER]: {
    strRole: EUserRole.PROVIDER_USER,
    strDisplayName: 'Provider User',
    strDescription: 'Provider company user with product and order management',
    arrPermissions: [
      { strPermission: 'user:view', strDescription: 'View users', bIsGranted: true },
      { strPermission: 'partner:view', strDescription: 'View partners', bIsGranted: true },
      { strPermission: 'product:manage', strDescription: 'Manage products', bIsGranted: true },
      { strPermission: 'quote:view', strDescription: 'View quotes', bIsGranted: true },
      { strPermission: 'order:manage', strDescription: 'Manage orders', bIsGranted: true },
      { strPermission: 'reports:view', strDescription: 'View reports', bIsGranted: true },
      { strPermission: 'analytics:view', strDescription: 'View analytics', bIsGranted: true },
    ]
  },
  [EUserRole.PARTNER_ADMIN]: {
    strRole: EUserRole.PARTNER_ADMIN,
    strDisplayName: 'Partner Admin',
    strDescription: 'Partner company administrator with team management',
    arrPermissions: [
      { strPermission: 'user:create', strDescription: 'Create new users for own partner', bIsGranted: true },
      { strPermission: 'user:manage_partner', strDescription: 'Manage users within own partner organization', bIsGranted: true },
      { strPermission: 'user:view', strDescription: 'View users within own partner organization', bIsGranted: true },
      { strPermission: 'partner:view', strDescription: 'View own partner info', bIsGranted: true },
      { strPermission: 'product:view', strDescription: 'View products', bIsGranted: true },
      { strPermission: 'quote:manage', strDescription: 'Manage partner quotes', bIsGranted: true },
      { strPermission: 'order:view', strDescription: 'View partner orders', bIsGranted: true },
      { strPermission: 'reports:view', strDescription: 'View partner reports', bIsGranted: true },
    ]
  },
  [EUserRole.PARTNER_CUSTOMER]: {
    strRole: EUserRole.PARTNER_CUSTOMER,
    strDisplayName: 'Partner Customer',
    strDescription: 'Partner company customer with quote and order access',
    arrPermissions: [
      { strPermission: 'user:view', strDescription: 'View users within own partner organization', bIsGranted: true },
      { strPermission: 'quote:view', strDescription: 'View quotes created for them by their partner', bIsGranted: true },
      { strPermission: 'quote:accept', strDescription: 'Accept quotes created for them', bIsGranted: true },
      { strPermission: 'quote:reject', strDescription: 'Reject quotes created for them', bIsGranted: true },
      { strPermission: 'order:view', strDescription: 'View own orders', bIsGranted: true },
    ]
  }
};

// Permission checking functions
export function fnHasPermission(strUserRole: string, strPermission: string): boolean {
  const objRoleDef = objRoleDefinitions[strUserRole as EUserRole];
  if (!objRoleDef) return false;
  
  return objRoleDef.arrPermissions.some(
    permission => permission.strPermission === strPermission && permission.bIsGranted
  );
}

export function fnGetRolePermissions(strRole: string): IRolePermission[] {
  const objRoleDef = objRoleDefinitions[strRole as EUserRole];
  return objRoleDef ? objRoleDef.arrPermissions : [];
}

export function fnGetRoleDisplayName(strRole: string): string {
  const objRoleDef = objRoleDefinitions[strRole as EUserRole];
  return objRoleDef ? objRoleDef.strDisplayName : strRole;
}

export function fnGetRoleDescription(strRole: string): string {
  const objRoleDef = objRoleDefinitions[strRole as EUserRole];
  return objRoleDef ? objRoleDef.strDescription : '';
}

export function fnGetAllRoles(): IRoleDefinition[] {
  return Object.values(objRoleDefinitions);
}

// Role hierarchy (for inheritance if needed)
export const objRoleHierarchy: Record<EUserRole, EUserRole[]> = {
  [EUserRole.SUPER_ADMIN]: [EUserRole.PROVIDER_USER, EUserRole.PARTNER_ADMIN, EUserRole.PARTNER_CUSTOMER],
  [EUserRole.PROVIDER_USER]: [EUserRole.PARTNER_ADMIN, EUserRole.PARTNER_CUSTOMER],
  [EUserRole.PARTNER_ADMIN]: [EUserRole.PARTNER_CUSTOMER],
  [EUserRole.PARTNER_CUSTOMER]: []
};

// Check if a role can manage another role
export function fnCanManageRole(strManagerRole: string, strTargetRole: string): boolean {
  const arrManageableRoles = objRoleHierarchy[strManagerRole as EUserRole];
  return arrManageableRoles ? arrManageableRoles.includes(strTargetRole as EUserRole) : false;
} 