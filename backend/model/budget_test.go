package model_test

import (
	"testing"

	"simple-fi/model"
	"simple-fi/store"
)

const budgetUserID = "budget-test-user"

func setupBudgetDB(t *testing.T) interface{ Close() error } {
	t.Helper()
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	return db
}

func TestCreateAndListBudget(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	input := model.BudgetInput{
		Name:       "Monthly Spending",
		Amount:     20000,
		PeriodType: "month",
	}
	bp, err := model.CreateBudget(db, budgetUserID, input)
	if err != nil {
		t.Fatalf("CreateBudget: %v", err)
	}
	if bp.ID == "" {
		t.Error("expected generated ID")
	}
	if bp.Name != "Monthly Spending" {
		t.Errorf("expected name 'Monthly Spending', got %q", bp.Name)
	}
	if bp.Amount != 20000 {
		t.Errorf("expected amount 20000, got %.2f", bp.Amount)
	}
	if bp.Spent != 0 {
		t.Errorf("expected 0 spent initially, got %.2f", bp.Spent)
	}
	if bp.Percentage != 0 {
		t.Errorf("expected 0%% initially, got %.2f", bp.Percentage)
	}
	if len(bp.Categories) != 0 {
		t.Errorf("expected 0 categories, got %d", len(bp.Categories))
	}

	all, err := model.ListBudgets(db, budgetUserID, nil)
	if err != nil {
		t.Fatalf("ListBudgets: %v", err)
	}
	if len(all) != 1 {
		t.Fatalf("expected 1 budget, got %d", len(all))
	}
	if all[0].ID != bp.ID {
		t.Errorf("ID mismatch")
	}
}

func TestBudgetCategoryLimits(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	input := model.BudgetInput{
		Name:       "Monthly with Categories",
		Amount:     20000,
		PeriodType: "month",
		Categories: []model.BudgetCategoryLimitInput{
			{CategoryID: "cat-food", Amount: 5000},
			{CategoryID: "cat-transport", Amount: 3000},
		},
	}
	bp, err := model.CreateBudget(db, budgetUserID, input)
	if err != nil {
		t.Fatalf("CreateBudget: %v", err)
	}
	if len(bp.Categories) != 2 {
		t.Fatalf("expected 2 category limits, got %d", len(bp.Categories))
	}

	found := false
	for _, c := range bp.Categories {
		if c.CategoryID == "cat-food" {
			found = true
			if c.Limit != 5000 {
				t.Errorf("expected food limit 5000, got %.2f", c.Limit)
			}
		}
	}
	if !found {
		t.Error("cat-food not found in categories")
	}
}

func TestBudgetSpendCalculation(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	// Create an account so we can scope properly
	acct, err := model.CreateAccount(db, model.Account{Name: "Cash", Type: "cash"}, budgetUserID)
	if err != nil {
		t.Fatalf("CreateAccount: %v", err)
	}

	// Add confirmed expenses
	_, _ = model.Create(db, model.Transaction{
		Amount:    500,
		Type:      "expense",
		AccountID: acct.ID,
		Category:  "Food",
	}, budgetUserID)
	_, _ = model.Create(db, model.Transaction{
		Amount:    200,
		Type:      "expense",
		AccountID: acct.ID,
		Category:  "Transport",
	}, budgetUserID)
	// Income should NOT count
	_, _ = model.Create(db, model.Transaction{
		Amount:    5000,
		Type:      "income",
		AccountID: acct.ID,
		Category:  "Salary",
	}, budgetUserID)

	input := model.BudgetInput{
		Name:       "Whole Balance Budget",
		Amount:     10000,
		PeriodType: "month",
	}
	bp, err := model.CreateBudget(db, budgetUserID, input)
	if err != nil {
		t.Fatalf("CreateBudget: %v", err)
	}

	all, err := model.ListBudgets(db, budgetUserID, []string{acct.ID})
	if err != nil {
		t.Fatalf("ListBudgets: %v", err)
	}
	if len(all) != 1 {
		t.Fatalf("expected 1 budget")
	}
	got := all[0]
	if got.ID != bp.ID {
		t.Error("ID mismatch")
	}
	if got.Spent != 700 {
		t.Errorf("expected spent=700, got %.2f", got.Spent)
	}
	if got.Remaining != 9300 {
		t.Errorf("expected remaining=9300, got %.2f", got.Remaining)
	}
	wantPct := 700.0 / 10000.0 * 100
	if got.Percentage < wantPct-0.001 || got.Percentage > wantPct+0.001 {
		t.Errorf("expected percentage %.4f, got %.4f", wantPct, got.Percentage)
	}
}

func TestBudgetTransferExclusion(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	acct, _ := model.CreateAccount(db, model.Account{Name: "Cash", Type: "cash"}, budgetUserID)
	acct2, _ := model.CreateAccount(db, model.Account{Name: "Savings", Type: "savings"}, budgetUserID)

	// Transfer: should NOT count
	_, _ = model.Create(db, model.Transaction{
		Amount:      1000,
		Type:        "transfer",
		AccountID:   acct.ID,
		ToAccountID: acct2.ID,
	}, budgetUserID)
	// Real expense: should count
	_, _ = model.Create(db, model.Transaction{
		Amount:    300,
		Type:      "expense",
		AccountID: acct.ID,
	}, budgetUserID)

	_, _ = model.CreateBudget(db, budgetUserID, model.BudgetInput{
		Name:       "Test",
		Amount:     5000,
		PeriodType: "month",
	})

	all, _ := model.ListBudgets(db, budgetUserID, []string{acct.ID, acct2.ID})
	if all[0].Spent != 300 {
		t.Errorf("expected spent=300 (transfer excluded), got %.2f", all[0].Spent)
	}
}

func TestBudgetCreditPaymentExclusion(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	acct, _ := model.CreateAccount(db, model.Account{Name: "Cash", Type: "cash"}, budgetUserID)
	creditAcct, _ := model.CreateAccount(db, model.Account{Name: "Credit", Type: "credit"}, budgetUserID)

	// Expense with to_account_id = credit card → credit card payment, should NOT count
	_, _ = model.Create(db, model.Transaction{
		Amount:      500,
		Type:        "expense",
		AccountID:   acct.ID,
		ToAccountID: creditAcct.ID,
	}, budgetUserID)
	// Normal expense: should count
	_, _ = model.Create(db, model.Transaction{
		Amount:    200,
		Type:      "expense",
		AccountID: acct.ID,
	}, budgetUserID)

	_, _ = model.CreateBudget(db, budgetUserID, model.BudgetInput{
		Name:       "Test",
		Amount:     5000,
		PeriodType: "month",
	})

	all, _ := model.ListBudgets(db, budgetUserID, []string{acct.ID, creditAcct.ID})
	if all[0].Spent != 200 {
		t.Errorf("expected spent=200 (credit payment excluded), got %.2f", all[0].Spent)
	}
}

func TestBudgetDateRangeCustom(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	// Custom budget from 2026-01-01 to 2026-04-01
	bp, err := model.CreateBudget(db, budgetUserID, model.BudgetInput{
		Name:       "Q1 2026",
		Amount:     50000,
		PeriodType: "custom",
		StartDate:  "2026-01-01",
		EndDate:    "2026-04-01",
	})
	if err != nil {
		t.Fatalf("CreateBudget: %v", err)
	}
	if bp.StartDate != "2026-01-01" {
		t.Errorf("expected start_date '2026-01-01', got %q", bp.StartDate)
	}
	if bp.EndDate != "2026-04-01" {
		t.Errorf("expected end_date '2026-04-01', got %q", bp.EndDate)
	}
}

func TestBudgetPerAccountScope(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	acct1, _ := model.CreateAccount(db, model.Account{Name: "Cash", Type: "cash"}, budgetUserID)
	acct2, _ := model.CreateAccount(db, model.Account{Name: "Savings", Type: "savings"}, budgetUserID)

	_, _ = model.Create(db, model.Transaction{Amount: 500, Type: "expense", AccountID: acct1.ID}, budgetUserID)
	_, _ = model.Create(db, model.Transaction{Amount: 300, Type: "expense", AccountID: acct2.ID}, budgetUserID)

	// Budget scoped to acct1 only
	_, err = model.CreateBudget(db, budgetUserID, model.BudgetInput{
		Name:       "Cash Budget",
		Amount:     5000,
		PeriodType: "month",
		AccountID:  acct1.ID,
	})
	if err != nil {
		t.Fatalf("CreateBudget: %v", err)
	}

	all, _ := model.ListBudgets(db, budgetUserID, []string{acct1.ID, acct2.ID})
	if all[0].Spent != 500 {
		t.Errorf("per-account budget: expected spent=500, got %.2f", all[0].Spent)
	}
}

func TestBudgetOwnershipEnforcement(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	bp, _ := model.CreateBudget(db, budgetUserID, model.BudgetInput{
		Name:       "Mine",
		Amount:     1000,
		PeriodType: "month",
	})

	// Other user cannot get it
	_, err = model.GetBudget(db, bp.ID, "other-user", nil)
	if err == nil {
		t.Error("expected error for non-owner get")
	}

	// Other user cannot delete it
	err = model.DeleteBudget(db, bp.ID, "other-user")
	if err == nil {
		t.Error("expected error for non-owner delete")
	}
}

func TestBudgetDeleteCascade(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	bp, _ := model.CreateBudget(db, budgetUserID, model.BudgetInput{
		Name:       "With Cats",
		Amount:     20000,
		PeriodType: "month",
		Categories: []model.BudgetCategoryLimitInput{
			{CategoryID: "cat-food", Amount: 5000},
		},
	})

	if err := model.DeleteBudget(db, bp.ID, budgetUserID); err != nil {
		t.Fatalf("DeleteBudget: %v", err)
	}

	all, _ := model.ListBudgets(db, budgetUserID, nil)
	if len(all) != 0 {
		t.Errorf("expected 0 budgets after delete, got %d", len(all))
	}
}

func TestBudgetUpdateReplacesCategories(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	bp, _ := model.CreateBudget(db, budgetUserID, model.BudgetInput{
		Name:       "Budget",
		Amount:     20000,
		PeriodType: "month",
		Categories: []model.BudgetCategoryLimitInput{
			{CategoryID: "cat-food", Amount: 5000},
		},
	})

	updated, err := model.UpdateBudget(db, bp.ID, budgetUserID, model.BudgetInput{
		Name:       "Renamed Budget",
		Amount:     25000,
		PeriodType: "month",
		Categories: []model.BudgetCategoryLimitInput{
			{CategoryID: "cat-transport", Amount: 3000},
		},
	}, nil)
	if err != nil {
		t.Fatalf("UpdateBudget: %v", err)
	}
	if updated.Name != "Renamed Budget" {
		t.Errorf("expected name 'Renamed Budget', got %q", updated.Name)
	}
	if updated.Amount != 25000 {
		t.Errorf("expected amount 25000, got %.2f", updated.Amount)
	}
	if len(updated.Categories) != 1 || updated.Categories[0].CategoryID != "cat-transport" {
		t.Errorf("expected single cat-transport category after update")
	}
}
