import { createQuery } from "@tanstack/solid-query";
import { fetchAllTransactions, fetchAccounts, fetchMe } from "../lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n);

type BalanceHeaderProps = {
  onMenuOpen: () => void;
};

export default function BalanceHeader(props: BalanceHeaderProps) {
  const meQuery = createQuery(() => ({
    queryKey: ["me"],
    queryFn: fetchMe,
  }));
  const accountsQuery = createQuery(() => ({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  }));
  const transactionsQuery = createQuery(() => ({
    queryKey: ["transactions-summary"],
    queryFn: fetchAllTransactions,
  }));

  const accounts = () => accountsQuery.data ?? [];
  const transactions = () => transactionsQuery.data ?? [];

  const balance = () => accounts().reduce((sum, a) => sum + a.balance, 0);
  const income = () =>
    transactions()
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
  const expenses = () =>
    transactions()
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

  return (
    <header aria-label="Balance summary" class="px-6 pt-4 pb-6 text-center">
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-gray-400">
          Hi, <span class="text-white font-medium">{meQuery.data?.name ?? ""}</span>
        </p>
        <button
          type="button"
          onClick={props.onMenuOpen}
          class="p-1.5 -mr-1.5 text-gray-400 hover:text-white transition-colors"
          aria-label="Open menu"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
      <p class="text-xs font-medium tracking-widest text-gray-500 uppercase mb-3">
        Total Balance
      </p>
      <div class="text-5xl font-bold text-white mb-4 tabular-nums">
        {fmt(balance())}
      </div>
      <div class="flex justify-center gap-6 text-sm">
        <div class="flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
          <span class="text-gray-400">
            <span class="text-blue-400 font-medium">{fmt(income())}</span> in
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" />
          <span class="text-gray-400">
            <span class="text-purple-400 font-medium">{fmt(expenses())}</span>{" "}
            out
          </span>
        </div>
      </div>
    </header>
  );
}
