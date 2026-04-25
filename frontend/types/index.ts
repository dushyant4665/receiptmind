export type ExpenseStatus = "pending" | "approved" | "rejected";

export type User = {
  id: string;
  email: string;
  name?: string;
  role?: string;
  avatarUrl?: string;
  companyName?: string;
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
  filename: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  status: string;
  vendorName: string;
  amount?: number;
  currency: string;
  date?: string;
  category: string;
  description: string;
  createdAt: string;
  processedAt?: string;
};

export type DashboardStats = {
  totalSpent: number;
  receiptCount: number;
  expenseCount: number;
  monthlyChange: number;
  accuracyRate: number;
  timeSavedHours: number;
};

export type DashboardActivity = {
  id: string;
  type: string;
  label: string;
  createdAt: string;
};

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};
