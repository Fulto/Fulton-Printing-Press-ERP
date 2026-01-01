
import { OWNER_ID, AUTHORIZED_IPS } from "../constants.ts";
import { AuditEntry } from "../types.ts";

// Fix: Exporting isSystemOwner to check for Super Admin privileges
export const isSystemOwner = (userId: string): boolean => {
  return userId === OWNER_ID;
};

// Fix: Exporting logSecurityEvent to maintain a persistent audit trail in localStorage
export const logSecurityEvent = (userId: string, action: string, module: string, before: any, after: any) => {
  const auditLogs: AuditEntry[] = JSON.parse(localStorage.getItem('fuppas_audit') || '[]');
  const entry: AuditEntry = {
    id: `audit-${Date.now()}-${Math.random()}`,
    timestamp: Date.now(),
    userId,
    action,
    module,
    before,
    after,
    ipAddress: '127.0.0.1' // Simulated IP address
  };
  auditLogs.unshift(entry);
  localStorage.setItem('fuppas_audit', JSON.stringify(auditLogs.slice(0, 500)));
  console.log(`[Security Audit] ${action} by ${userId} in ${module}`);
};
