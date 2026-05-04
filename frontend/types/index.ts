export type ExpenseStatus = "pending" | "approved" | "rejected";

export type User = {
  id: string;
  email: string;
  name?: string;
  role?: string;
  avatarUrl?: string;
  companyName?: string;
  organizationId?: string;
};

export type Expense = {
  id: string;
  vendorName: string;
  amount: number;
  currency: string;
  date: string;
  category: string;
  description: string;
  receiptUrl?: string;
  status: ExpenseStatus;
};

export type Receipt = {
  id: string;
  organizationId: string;
  userId: string;
  filePath: string;
  status: string;
  rawVendorName?: string | null;
  rawAmount?: number | null;
  rawDate?: string | null;
  rawCategory?: string | null;
  rawConfidence?: number | null;
  vendorName?: string | null;
  amount?: number | null;
  receiptDate?: string | null;
  category?: string | null;
  confidence?: number | null;
  createdAt: string;
  fileUrl?: string;
  exceptions?: Exception[];
};

export type LocalOptimisticReceipt = Receipt & {
  isOptimistic: boolean;
};

export type ReceiptListResponse = {
  receipts: (Receipt | LocalOptimisticReceipt)[];
  total: number;
  limit: number;
  offset: number;
};

export type ReceiptUploadResponse = {
  receipt_id: string;
  status: string;
};

export type Exception = {
  id: string;
  receiptId: string;
  organizationId: string;
  type: string;
  field: string;
  message: string;
  status: string;
  createdAt: string;
};

export type Rule = {
  id: string;
  organizationId: string;
  conditionType: string;
  conditionValue: string;
  actionType: string;
  actionValue: string;
  isActive: boolean;
  createdAt: string;
};

export type DashboardStats = {
  totalReceipts: number;
  totalAmount: number;
  processedCount: number;
  pendingCount: number;
  needsReviewCount: number;
};

export type DashboardActivity = {
  id: string;
  type: string;
  label: string;
  createdAt: string;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};
