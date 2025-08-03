import { EUserRole } from './roles';

// Check if user role can bypass partner isolation
export function fnCanBypassPartnerIsolation(strUserRole: string): boolean {
  return strUserRole === EUserRole.SUPER_ADMIN || strUserRole === EUserRole.PROVIDER_USER;
} 