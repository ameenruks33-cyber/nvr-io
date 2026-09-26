export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  COLLECTOR = 'COLLECTOR',
}

export enum LoanStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CLOSED = 'CLOSED',
}

export enum DocumentType {
  CUSTOMER_PHOTO = 'CUSTOMER_PHOTO',
  PASSPORT_SCAN = 'PASSPORT_SCAN',
  AADHAAR_SCAN = 'AADHAAR_SCAN',
  OTHER = 'OTHER',
}

export enum NotificationType {
  LOAN_COMPLETED = 'LOAN_COMPLETED',
  REPAYMENT_RECEIVED = 'REPAYMENT_RECEIVED',
  SYSTEM = 'SYSTEM',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export const LOAN_DEFAULTS = {
  principalAmount: 1800,
  dailyPayment: 100,
  currency: 'AED',
} as const;

export interface DashboardStats {
  totalCustomers: number;
  activeLoans: number;
  completedLoans: number;
  totalDisbursed: number;
  totalCollected: number;
  totalOutstanding: number;
  todaysCollections: number;
}
