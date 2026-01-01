
export const MAX_BRANCHES = 10;
export const SHOP_OVERHEAD_RATE = 10; // $10/hr
export const WASTE_PERCENTAGE = 0.10; // 10%
export const MARKUP_MAX = 0.40;

// SECURITY
export const DEFAULT_MANAGER_PASSWORD = "FuPPAS-2022";
export const OWNER_PASSWORD = "FuPPAS-MASTER-2024"; // In a real app, this would be hashed

// IDENTITY LOCK: The specific ID required for Super Admin / Owner access
export const OWNER_ID = "FUPPAS-OWNER-ALPHA-2024-X";
export const OWNER_EMAIL = "fuppasenterprise2022@gmail.com";

// IP WHITELIST: Simulated authorized access points
export const AUTHORIZED_IPS = ["127.0.0.1", "192.168.1.1", "41.223.120.10"];

export const HEAD_OFFICE_INFO = {
  address: "Cooper Farm Community, Block C, Montserrado County, Liberia",
  phones: ["0776565917", "0778246111", "0886069005"],
  emails: ["contact@fuppas.tech", OWNER_EMAIL]
};

export const MANAGER_SUPPORT_MANUAL = `
FuPPAS Manager Support Manual:
1. Branch Profile: Managers must input address/name for invoice headers.
2. Stock Logic: Deduct paper/ink when job moves to "In-Press."
3. Payments: Record deposits as "Partial." The system tracks the balance.
4. Transfers: Allow stock to move between branches via a "Transfer Request" log.
5. Deletion: Managers cannot delete transactions, only "Void" with a reason.
6. Support: Contact Super Admin for price overrides above 40%.
`;
