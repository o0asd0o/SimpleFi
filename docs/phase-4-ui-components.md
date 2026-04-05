# Phase 4: UI Components (Full Interactive Interface)

**Depends on**: Phase 3 (scaffold with live data confirmed)

## Goal

All 4 UI components built and integrated. The app is fully functional: view balance, add transactions via the bottom sheet, see recent entries, view category statistics.

## Files to Create

| File                                           | Purpose                                                              |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| `frontend/src/components/BalanceHeader.tsx`    | Sticky top: massive balance, income/expense sub-totals               |
| `frontend/src/components/TransactionSheet.tsx` | Bottom sheet: number input, category pills, "Spent"/"Earned" buttons |
| `frontend/src/components/RecentList.tsx`       | `<For>` list of recent transactions                                  |
| `frontend/src/components/StatBars.tsx`         | CSS-only percentage bars per category                                |

## Modify

`frontend/src/App.tsx` — Replace raw JSON dump with real layout + FAB button.

## Component Details

### `App.tsx` Final Layout

```
<div class="bg-app-bg min-h-screen text-white">
  <BalanceHeader transactions={transactions()} />

  {/* View toggle */}
  <div> ... "Recent" | "Stats" toggle buttons ... </div>

  <Show when={showStats()} fallback={<RecentList transactions={transactions()} />}>
    <StatBars statistics={statistics()} currentMonth={currentMonth()} setCurrentMonth={setCurrentMonth} />
  </Show>

  {/* FAB */}
  <button aria-label="Add transaction" onClick={() => setIsSheetOpen(true)}>
    + (purple gradient circle, fixed bottom-right)
  </button>

  <Show when={isSheetOpen()}>
    <TransactionSheet
      onClose={() => setIsSheetOpen(false)}
      onSubmit={async (data) => { await createTransaction(data); refetchTx(); }}
    />
  </Show>
</div>
```

Body scroll lock when sheet is open:

```ts
createEffect(() => {
  document.body.style.overflow = isSheetOpen() ? "hidden" : "";
});
```

---

### `BalanceHeader.tsx`

**Props**: `transactions: Transaction[] | undefined`

- Compute balance from prop (do not fetch internally):
  - `income = transactions.filter(t => t.type === 'income').reduce(sum)`
  - `expense = transactions.filter(t => t.type === 'expense').reduce(sum)`
  - `balance = income - expense`
- Layout:
  - Main balance: `text-4xl font-bold` or `text-5xl`, centered
  - Sub-totals below: income (blue-400) and expense (purple-500) as smaller secondary `text-sm text-gray-400` labels
- Use `<header>` with `aria-label="Account overview"`
- Loading state: `<Show when={transactions !== undefined}>` — show skeleton or nothing while loading
- No red/green — use blue/purple for the income/expense distinction

---

### `TransactionSheet.tsx`

**Props**: `onClose: () => void`, `onSubmit: (data: CreateTransactionPayload) => Promise<void>`

**Structure**:

```
<div> {/* Full-screen backdrop */}
  <div role="none" class="bg-black/50 inset-0 fixed" onClick={onClose} />
  <div role="dialog" aria-modal="true" aria-label="Add transaction"> {/* Sheet */}
    <input type="number" inputMode="decimal" ... />
    {/* Category pills (horizontal scroll) */}
    {/* Optional description input */}
    <div> {/* Action row */}
      <button onClick={() => submit('expense')}>Spent</button>
      <button onClick={() => submit('income')}>Earned</button>
    </div>
  </div>
</div>
```

**Slide-up animation**:

```css
/* When open: */
transform: translateY(0)     transition-transform duration-300 ease-out
/* When closed: */
transform: translateY(100%)
```

Wrap in `motion-safe:` Tailwind variant or conditionally disable with `prefers-reduced-motion`.

**Internal signals**:

```ts
const [amount, setAmount] = createSignal("");
const [category, setCategory] = createSignal("General");
const [description, setDescription] = createSignal("");
```

**Auto-focus**: Use `ref` callback after transition:

```ts
let inputRef: HTMLInputElement;
onMount(() => setTimeout(() => inputRef?.focus(), 50));
```

**Keyboard**:

- `Enter` → submit as "Spent"
- `Escape` → call `onClose()`

**Validation**: `parseFloat(amount())` must be a finite number > 0 before submitting.

**Categories**: Food, Transport, Bills, Entertainment, General (horizontal scrollable pill row)

**On submit**: calls `onSubmit({ amount: parseFloat(amount()), type, category, description })`, then resets form signals and calls `onClose()`.

**Focus return**: on close, return focus to the FAB button.

---

### `RecentList.tsx`

**Props**: `transactions: Transaction[] | undefined`

```tsx
<ul aria-label="Recent transactions">
  <For each={transactions()}>
    {(tx) => (
      <li>
        <span class={tx.type === 'expense' ? 'bg-purple-500' : 'bg-blue-400'} />  {/* Color dot */}
        <div>
          <span>{tx.description || tx.category}</span>
          <span class="text-gray-400 text-sm">{tx.category} · {formatDate(tx.created_at)}</span>
        </div>
        <span>{tx.type === 'expense' ? '-' : '+'}{tx.amount.toFixed(2)}</span>
      </li>
    )}
  </For>
</ul>

<Show when={transactions !== undefined && transactions.length === 0}>
  <p class="text-gray-400 text-center py-8">No transactions yet. Tap + to add one.</p>
</Show>
```

- Date format: relative ("2 days ago") or short ("Apr 3") — use `Intl.RelativeTimeFormat` or a simple helper
- No red/green — purple for expense, blue for income

---

### `StatBars.tsx`

**Props**: `statistics: CategoryStat[] | undefined`, `currentMonth: string`, `setCurrentMonth: (m: string) => void`

```tsx
<section aria-label="Spending statistics">
  {/* Month navigator */}
  <div>
    <button onClick={prevMonth}>‹</button>
    <span>{formatMonth(currentMonth)}</span>
    <button onClick={nextMonth}>›</button>
  </div>

  <For each={statistics()}>
    {(stat, index) => (
      <div>
        <div>
          {" "}
          {/* Row: label left, amount right */}
          <span>{stat.category}</span>
          <span class="text-gray-400">${stat.amount.toFixed(2)}</span>
        </div>
        <div class="h-2 bg-white/10 rounded-full">
          {" "}
          {/* Track */}
          <div
            class={`h-2 rounded-full motion-safe:transition-all motion-safe:duration-700 ${barColor(index())}`}
            style={{ width: `${stat.percentage}%` }}
          />
        </div>
      </div>
    )}
  </For>

  <Show when={statistics !== undefined && statistics.length === 0}>
    <p class="text-gray-400 text-center py-8">No expenses this month.</p>
  </Show>
</section>
```

Bar colors cycle: `['bg-purple-500', 'bg-blue-400', 'bg-pink-500']`

Month navigation helpers:

```ts
function prevMonth(m: string): string; // subtract 1 month from YYYY-MM
function nextMonth(m: string): string; // add 1 month from YYYY-MM
```

## Accessibility Checklist

- [ ] All interactive elements are `<button>` (not `<div onClick>`)
- [ ] FAB: `aria-label="Add transaction"`
- [ ] Sheet: `role="dialog"`, `aria-modal="true"`, `aria-label`
- [ ] Number input has a visible or `sr-only` `<label>`
- [ ] Focus trap inside open sheet
- [ ] Focus returns to FAB when sheet closes
- [ ] Color contrast: white text on `#120F1C` ≥ 4.5:1 ratio (WCAG AA)
- [ ] Sheet backdrop click dismisses (not just X button)
- [ ] `prefers-reduced-motion`: transitions disabled or instant

## Verify

1. Zero-transaction state: empty state messages render in both views
2. FAB → sheet slides up → number input auto-focused
3. Enter amount → select category → "Spent" → sheet closes → transaction appears in list → balance updates
4. Add income entry → balance adjusts correctly
5. Switch to Stats tab → bars render with correct proportions
6. Keyboard: Tab through sheet, Enter submits, Escape closes
7. Mobile viewport (375px): no horizontal overflow, all tap targets ≥ 44px
8. DevTools: enable "Reduce motion" → all transitions are instant

## Gotchas

- SolidJS `<For>` key function: `(tx) => tx.id` — not index
- `createResource` accessor is a function: always `transactions()`, never `transactions`
- `type="number"` input: validate with `parseFloat`, not `parseInt`. Reject `NaN` and non-positive values.
- Do NOT use ternaries in JSX for conditional rendering — use `<Show>` and `<Switch>`/`<Match>` per CLAUDE.md
- `onMount` runs after the component mounts but before transitions complete — use `setTimeout` for auto-focus to wait for the slide animation
