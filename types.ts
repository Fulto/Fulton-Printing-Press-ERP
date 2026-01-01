
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  BRANCH_MANAGER = 'BRANCH_MANAGER'
}

export enum JobStatus {
  QUOTED = 'Quoted',
  IN_PRESS = 'In-Press',
  READY = 'Ready',
  COMPLETED = 'Completed'
}

export enum ServiceType {
  PRINT = 'Print',
  PHOTOCOPY = 'Photocopy',
  SCAN = 'Scan',
  RESEARCH = 'Research',
  RELATED_PRINTING = 'Related Printing Job',
  DESIGN = 'Graphic Design',
  BINDING = 'Binding',
  LAMINATING = 'Laminating',
  OTHER = 'Other'
}

export enum PaymentStatus {
  PAID = 'Paid',
  UNPAID = 'Unpaid',
  PARTIALLY_PAID = 'Partially Paid',
  IN_PROGRESS = 'In Progress'
}

export enum InventoryType {
  RAW_MATERIAL = 'Raw Material',
  RETAIL_PRODUCT = 'Retail Product'
}

export enum PaymentMethod {
  CASH = 'Cash',
  CARD = 'Card',
  TRANSFER = 'Transfer',
  MOBILE_MONEY = 'Mobile Money'
}

export enum TransferStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  DENIED = 'Denied'
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  branchNumber: string;
  branchEmail: string;
  managerId: string;
  managerName: string;
  managerAddress: string;
  managerPhone: string;
  status: 'ACTIVE' | 'INACTIVE';
  establishedDate: number;
}

export interface ManagerAccount {
  id: string;
  name: string;
  password?: string; // New field for security
  branchId: string;
  isActive: boolean;
  lastLogin?: number;
}

export interface AuditEntry {
  id: string;
  timestamp: number;
  userId: string;
  action: string;
  module: string;
  before: any;
  after: any;
  ipAddress: string;
}

export interface InventoryItem {
  id: string;
  branchId: string;
  sku: string;
  name: string;
  category: string;
  type: InventoryType;
  stockLevel: number;
  reorderPoint: number;
  unitCost: number;
  retailPrice?: number;
  quantityPerUnit?: number;
  unitName?: string;
  bulkUnitName?: string;
}

export interface BusinessExpense {
  id: string;
  branchId: string;
  materialName: string;
  description: string;
  amount: number;
  timestamp: number;
  category: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  branchId: string;
  createdAt: number;
}

export interface CommunicationLog {
  id: string;
  customerId: string;
  timestamp: number;
  type: 'PHONE' | 'EMAIL' | 'IN_PERSON' | 'SYSTEM';
  notes: string;
  userId: string;
}

export interface Job {
  id: string;
  branchId: string;
  customerId?: string; // Linked to CRM
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  serviceType: ServiceType;
  paymentStatus: PaymentStatus;
  specs: {
    gsm?: number;
    quantity: number;
    size: string;
  };
  pricing: {
    materialCost: number;
    laborCost: number;
    overhead: number;
    subtotal: number;
    markup: number;
    total: number;
    breakdown: {
      costPerSheet: number;
      inkUsage: number;
      inkUnitPrice: number;
      inkCost: number;
      hours: number;
      staffRate: number;
      machineHours: number;
      wastePercentage: number;
    };
  };
  status: JobStatus;
  amountPaid: number;
  createdAt: number;
  completionNote?: string;
  qualityVerified?: boolean;
}

export interface Transaction {
  id: string;
  branchId: string;
  orderId: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  timestamp: number;
  type: 'RETAIL' | 'JOB';
  isVoid?: boolean;
  voidReason?: string;
}

export interface StockTransfer {
  id: string;
  originBranchId: string;
  destinationBranchId: string;
  itemId: string;
  itemName: string;
  sku: string;
  quantity: number;
  status: TransferStatus;
  timestamp: number;
}

export interface AppNotification {
  id: string;
  branchId: string | null;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  isRead: boolean;
  timestamp: number;
}

export interface BackupLog {
  id: string;
  timestamp: number;
  status: 'SUCCESS' | 'FAILED';
  summary: string;
  sizeKb: number;
  recipient: string;
  dataSnapshot?: string;
}
