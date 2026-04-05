const BASE_URL = import.meta.env.VITE_API_URL ?? "";

export type Transaction = {
  id: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  category: string;
  category_id: string;
  description: string;
  account_id: string;
  to_account_id?: string;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  icon: string;
  type: "expense" | "income";
  sort_order: number;
  created_at: string;
};

export type CategoryStat = {
  category: string;
  icon: string;
  amount: number;
  percentage: number;
};

export type AnalyticsPeriod = "30d" | "month" | "ytd" | "lastyear";

export type AccountStat = {
  account_id: string;
  account_name: string;
  account_type: string;
  amount: number;
  percentage: number;
};

export type AnalyticsResult = {
  period: string;
  total: number;
  by_category: CategoryStat[];
  by_account: AccountStat[];
};

export type CreateTransactionInput = {
  amount: number;
  type: "income" | "expense" | "transfer";
  category?: string;
  category_id?: string;
  description?: string;
  account_id: string;
  to_account_id?: string;
};

export type Account = {
  id: string;
  name: string;
  type: "cash" | "credit" | "debit" | "savings";
  balance: number;
  created_at: string;
};

export type CreateAccountInput = {
  name: string;
  type: "cash" | "credit" | "debit" | "savings";
};

export type User = {
  id: string;
  username: string;
  name: string;
  created_at: string;
};

export type AuthResponse = {
  user: User;
  token: string;
  passphrase?: string;
};

async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.reload();
    throw new Error("Session expired");
  }
  return res;
}

export type TransactionPage = {
  items: Transaction[];
  next_cursor?: string;
};

export async function fetchTransactions(
  limit = 15,
  cursor?: string,
): Promise<TransactionPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  const res = await apiFetch(`/api/transactions?${params}`);
  if (!res.ok) throw new Error("Failed to fetch transactions");
  return res.json();
}

export async function fetchAllTransactions(): Promise<Transaction[]> {
  const res = await apiFetch("/api/transactions?limit=100");
  if (!res.ok) throw new Error("Failed to fetch transactions");
  const page: TransactionPage = await res.json();
  return page.items;
}

export async function createTransaction(
  data: CreateTransactionInput,
): Promise<Transaction> {
  const res = await apiFetch("/api/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create transaction");
  return res.json();
}

export async function fetchStatistics(month: string): Promise<CategoryStat[]> {
  const res = await apiFetch(`/api/statistics?month=${month}`);
  if (!res.ok) throw new Error("Failed to fetch statistics");
  return res.json();
}

export async function fetchAnalytics(
  period: AnalyticsPeriod,
): Promise<AnalyticsResult> {
  const res = await apiFetch(`/api/analytics?period=${period}`);
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

export async function fetchAccounts(): Promise<Account[]> {
  const res = await apiFetch("/api/accounts");
  if (!res.ok) throw new Error("Failed to fetch accounts");
  return res.json();
}

export async function createAccount(
  data: CreateAccountInput,
): Promise<Account> {
  const res = await apiFetch("/api/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create account");
  return res.json();
}

export async function updateAccount(
  id: string,
  data: CreateAccountInput,
): Promise<Account> {
  const res = await apiFetch(`/api/accounts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update account");
  return res.json();
}

export async function deleteAccount(id: string): Promise<void> {
  const res = await apiFetch(`/api/accounts/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Failed to delete account");
  }
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await apiFetch("/api/categories");
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json();
}

export async function createCategory(data: {
  name: string;
  icon: string;
  type: "expense" | "income";
}): Promise<Category> {
  const res = await apiFetch("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create category");
  return res.json();
}

export async function updateCategory(
  id: string,
  data: { name: string; icon: string },
): Promise<Category> {
  const res = await apiFetch(`/api/categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update category");
  return res.json();
}

export async function deleteCategory(id: string): Promise<void> {
  const res = await apiFetch(`/api/categories/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Failed to delete category");
  }
}

export async function login(
  username: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Login failed");
  }
  return res.json();
}

export async function register(
  username: string,
  password: string,
  name: string,
): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, name }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Registration failed");
  }
  return res.json();
}

export async function resetPassword(
  username: string,
  passphrase: string,
  newPassword: string,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, passphrase, new_password: newPassword }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Password reset failed");
  }
}

export async function fetchMe(): Promise<User> {
  const res = await apiFetch("/api/me");
  if (!res.ok) throw new Error("Failed to fetch user");
  const data = await res.json();
  return data.user;
}
