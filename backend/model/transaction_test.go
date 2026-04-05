package model_test

import (
	"testing"

	"simple-fi/model"
	"simple-fi/store"
)

const testUserID = "test-user-1"

func TestCreateAndList(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	// Create income
	income, err := model.Create(db, model.Transaction{
		Amount:   1000,
		Type:     "income",
		Category: "Salary",
	}, testUserID)
	if err != nil {
		t.Fatalf("Create income: %v", err)
	}
	if income.ID == "" {
		t.Error("expected generated ID")
	}

	// Create expense
	expense, err := model.Create(db, model.Transaction{
		Amount:   200,
		Type:     "expense",
		Category: "Food",
	}, testUserID)
	if err != nil {
		t.Fatalf("Create expense: %v", err)
	}

	// List returns both
	txs, err := model.List(db, testUserID)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(txs) != 2 {
		t.Fatalf("expected 2 transactions, got %d", len(txs))
	}
	ids := map[string]bool{txs[0].ID: true, txs[1].ID: true}
	if !ids[income.ID] || !ids[expense.ID] {
		t.Error("expected both transactions in list")
	}
}

func TestStatistics(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	month := "2026-04"

	_, _ = model.Create(db, model.Transaction{Amount: 400, Type: "expense", Category: "Food"}, testUserID)
	_, _ = model.Create(db, model.Transaction{Amount: 100, Type: "expense", Category: "Transport"}, testUserID)
	_, _ = model.Create(db, model.Transaction{Amount: 500, Type: "income", Category: "Salary"}, testUserID) // excluded

	stats, err := model.Statistics(db, testUserID, month)
	if err != nil {
		t.Fatalf("Statistics: %v", err)
	}
	if len(stats) != 2 {
		t.Fatalf("expected 2 categories, got %d", len(stats))
	}

	food := stats[0]
	if food.Category != "Food" {
		t.Errorf("expected Food first (highest), got %s", food.Category)
	}
	if food.Percentage < 79.9 || food.Percentage > 80.1 {
		t.Errorf("expected Food %%=80, got %.2f", food.Percentage)
	}

	transport := stats[1]
	if transport.Percentage < 19.9 || transport.Percentage > 20.1 {
		t.Errorf("expected Transport %%=20, got %.2f", transport.Percentage)
	}
}

func TestDefaultCategory(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	tx, err := model.Create(db, model.Transaction{Amount: 10, Type: "expense"}, testUserID)
	if err != nil {
		t.Fatal(err)
	}
	if tx.Category != "General" {
		t.Errorf("expected default category 'General', got %q", tx.Category)
	}
}

func TestCreateTransfer(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	// Seed accounts for this user
	if err := model.SeedDefaultAccountForUser(db, testUserID); err != nil {
		t.Fatal(err)
	}
	accounts, err := model.ListAccounts(db, testUserID)
	if err != nil {
		t.Fatal(err)
	}
	cashID := accounts[0].ID

	savings, err := model.CreateAccount(db, model.Account{Name: "Savings", Type: "savings"}, testUserID)
	if err != nil {
		t.Fatal(err)
	}

	transfer, err := model.Create(db, model.Transaction{
		Amount:      500,
		Type:        "transfer",
		AccountID:   cashID,
		ToAccountID: savings.ID,
	}, testUserID)
	if err != nil {
		t.Fatalf("Create transfer: %v", err)
	}
	if transfer.AccountID != cashID {
		t.Errorf("expected account_id %q, got %q", cashID, transfer.AccountID)
	}
	if transfer.ToAccountID != savings.ID {
		t.Errorf("expected to_account_id %q, got %q", savings.ID, transfer.ToAccountID)
	}
	if transfer.Category != "" {
		t.Errorf("expected empty category for transfer, got %q", transfer.Category)
	}

	// Verify transfer is in list
	txs, err := model.List(db, testUserID)
	if err != nil {
		t.Fatal(err)
	}
	if len(txs) != 1 {
		t.Fatalf("expected 1 transaction, got %d", len(txs))
	}
	if txs[0].Type != "transfer" {
		t.Errorf("expected type 'transfer', got %q", txs[0].Type)
	}

	// Verify transfer excluded from statistics
	month := txs[0].CreatedAt.Format("2006-01")
	stats, err := model.Statistics(db, testUserID, month)
	if err != nil {
		t.Fatal(err)
	}
	if len(stats) != 0 {
		t.Errorf("expected 0 stats (transfers excluded), got %d", len(stats))
	}
}

func TestCrossUserIsolation(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	user1 := "user-1"
	user2 := "user-2"

	_, err = model.Create(db, model.Transaction{Amount: 100, Type: "expense", Category: "Food"}, user1)
	if err != nil {
		t.Fatal(err)
	}
	_, err = model.Create(db, model.Transaction{Amount: 200, Type: "income", Category: "Salary"}, user2)
	if err != nil {
		t.Fatal(err)
	}

	txs1, _ := model.List(db, user1)
	txs2, _ := model.List(db, user2)

	if len(txs1) != 1 {
		t.Errorf("user1: expected 1 transaction, got %d", len(txs1))
	}
	if len(txs2) != 1 {
		t.Errorf("user2: expected 1 transaction, got %d", len(txs2))
	}
	if txs1[0].Amount != 100 {
		t.Errorf("user1: expected amount 100, got %.2f", txs1[0].Amount)
	}
	if txs2[0].Amount != 200 {
		t.Errorf("user2: expected amount 200, got %.2f", txs2[0].Amount)
	}
}
