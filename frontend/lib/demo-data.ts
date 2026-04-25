import type { DashboardActivity, DashboardStats, Expense, Receipt, User } from "@/types";

const DEMO_RECEIPTS_KEY = "receiptmind-demo-receipts";
const DEMO_PROFILE_KEY = "receiptmind-demo-profile";

const baseReceipts: Receipt[] = [
  {
    id: "demo-receipt-1",
    filename: "cafe-milano.jpg",
    fileUrl: "",
    fileSize: 182340,
    mimeType: "image/jpeg",
    status: "completed",
    vendorName: "Cafe Milano",
    amount: 84.2,
    currency: "USD",
    date: "2026-04-18",
    category: "Food",
    description: "Team lunch",
    createdAt: "2026-04-18T10:00:00.000Z",
    processedAt: "2026-04-18T10:01:00.000Z",
  },
  {
    id: "demo-receipt-2",
    filename: "uber-trip.pdf",
    fileUrl: "",
    fileSize: 91344,
    mimeType: "application/pdf",
    status: "completed",
    vendorName: "Uber",
    amount: 42.85,
    currency: "USD",
    date: "2026-04-17",
    category: "Travel",
    description: "Airport transfer",
    createdAt: "2026-04-17T08:30:00.000Z",
    processedAt: "2026-04-17T08:31:00.000Z",
  },
];

const baseExpenses: Expense[] = [
  {
    id: "demo-expense-1",
    vendorName: "Acme Travel",
    amount: 1249.45,
    currency: "USD",
    date: "2026-04-19",
    category: "Travel",
    description: "Offsite flight booking",
    status: "approved",
  },
  {
    id: "demo-expense-2",
    vendorName: "BrightOffice",
    amount: 321,
    currency: "USD",
    date: "2026-04-18",
    category: "Office",
    description: "Workspace supplies",
    status: "pending",
  },
  {
    id: "demo-expense-3",
    vendorName: "Nimbus Hotels",
    amount: 842.18,
    currency: "USD",
    date: "2026-04-17",
    category: "Travel",
    description: "Client meeting stay",
    status: "approved",
  },
];

const baseProfile: User = {
  id: "demo-user",
  email: "alex@receiptmind.ai",
  name: "Alex Mercer",
  role: "admin",
  companyName: "ReceiptMind Demo",
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getDemoReceipts(): Receipt[] {
  if (!canUseStorage()) {
    return baseReceipts;
  }

  const stored = window.localStorage.getItem(DEMO_RECEIPTS_KEY);
  if (!stored) {
    window.localStorage.setItem(DEMO_RECEIPTS_KEY, JSON.stringify(baseReceipts));
    return baseReceipts;
  }

  try {
    return JSON.parse(stored) as Receipt[];
  } catch {
    return baseReceipts;
  }
}

export function setDemoReceipts(receipts: Receipt[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(DEMO_RECEIPTS_KEY, JSON.stringify(receipts));
}

export function appendDemoReceipts(files: FileList | File[]) {
  const current = getDemoReceipts();
  const appended = Array.from(files).map((file, index) => ({
    id: `demo-upload-${Date.now()}-${index}`,
    filename: file.name,
    fileUrl: "",
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
    status: "completed",
    vendorName: file.name.replace(/\.[^.]+$/, ""),
    amount: undefined,
    currency: "USD",
    date: new Date().toISOString().slice(0, 10),
    category: "Uncategorized",
    description: "Uploaded in demo mode",
    createdAt: new Date().toISOString(),
    processedAt: new Date().toISOString(),
  }));

  setDemoReceipts([...appended, ...current]);
}

export function getDemoExpenses(): Expense[] {
  return baseExpenses;
}

export function getDemoProfile(): User {
  if (!canUseStorage()) {
    return baseProfile;
  }

  const stored = window.localStorage.getItem(DEMO_PROFILE_KEY);
  if (!stored) {
    window.localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify(baseProfile));
    return baseProfile;
  }

  try {
    return JSON.parse(stored) as User;
  } catch {
    return baseProfile;
  }
}

export function setDemoProfile(profile: User) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify(profile));
}

export function getDemoDashboardStats(): DashboardStats {
  const expenses = getDemoExpenses();
  const receipts = getDemoReceipts();
  const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return {
    totalSpent,
    receiptCount: receipts.length,
    expenseCount: expenses.length,
    monthlyChange: 12.5,
    accuracyRate: 99.2,
    timeSavedHours: 8.5,
  };
}

export function getDemoDashboardActivity(): DashboardActivity[] {
  return getDemoReceipts().slice(0, 4).map((receipt) => ({
    id: receipt.id,
    type: "receipt",
    label: `${receipt.vendorName || receipt.filename} processed`,
    createdAt: receipt.createdAt,
  }));
}
