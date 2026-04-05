package model_test

import (
	"errors"
	"testing"

	"simple-fi/model"
	"simple-fi/store"
)

func TestSeedDefaultAccountForUser(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	userID := "seed-test-user"
	if err := model.SeedDefaultAccountForUser(db, userID); err != nil {
		t.Fatal(err)
	}

	accounts, err := model.ListAccounts(db, userID)
	if err != nil {
		t.Fatalf("ListAccounts: %v", err)
	}
	if len(accounts) != 1 {
		t.Fatalf("expected 1 seeded account, got %d", len(accounts))
	}
	if accounts[0].Name != "Cash" {
		t.Errorf("expected name 'Cash', got %q", accounts[0].Name)
	}
	if accounts[0].Type != "cash" {
		t.Errorf("expected type 'cash', got %q", accounts[0].Type)
	}
}

func TestCreateAndListAccounts(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	userID := "account-test-user"
	if err := model.SeedDefaultAccountForUser(db, userID); err != nil {
		t.Fatal(err)
	}

	savings, err := model.CreateAccount(db, model.Account{Name: "BPI Savings", Type: "savings"}, userID)
	if err != nil {
		t.Fatalf("CreateAccount: %v", err)
	}
	if savings.ID == "" {
		t.Error("expected generated ID")
	}
	if savings.Balance != 0 {
		t.Errorf("expected balance 0, got %.2f", savings.Balance)
	}

	accounts, err := model.ListAccounts(db, userID)
	if err != nil {
		t.Fatalf("ListAccounts: %v", err)
	}
	// Cash + BPI Savings
	if len(accounts) != 2 {
		t.Fatalf("expected 2 accounts, got %d", len(accounts))
	}
}

func TestAccountBalanceFromTransactions(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	userID := "balance-test-user"
	if err := model.SeedDefaultAccountForUser(db, userID); err != nil {
		t.Fatal(err)
	}

	accounts, _ := model.ListAccounts(db, userID)
	cashID := accounts[0].ID

	// Income: +1000 to cash
	_, err = model.Create(db, model.Transaction{Amount: 1000, Type: "income", AccountID: cashID}, userID)
	if err != nil {
		t.Fatalf("Create income: %v", err)
	}

	// Expense: -200 from cash
	_, err = model.Create(db, model.Transaction{Amount: 200, Type: "expense", AccountID: cashID}, userID)
	if err != nil {
		t.Fatalf("Create expense: %v", err)
	}

	accounts, err = model.ListAccounts(db, userID)
	if err != nil {
		t.Fatalf("ListAccounts: %v", err)
	}
	if len(accounts) != 1 {
		t.Fatalf("expected 1 account, got %d", len(accounts))
	}
	if accounts[0].Balance != 800 {
		t.Errorf("expected balance 800, got %.2f", accounts[0].Balance)
	}
}

func TestAccountBalanceWithTransfers(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	userID := "transfer-test-user"
	if err := model.SeedDefaultAccountForUser(db, userID); err != nil {
		t.Fatal(err)
	}

	accounts, _ := model.ListAccounts(db, userID)
	cashID := accounts[0].ID

	savings, err := model.CreateAccount(db, model.Account{Name: "Savings", Type: "savings"}, userID)
	if err != nil {
		t.Fatal(err)
	}

	// Income: +1000 to cash
	_, err = model.Create(db, model.Transaction{Amount: 1000, Type: "income", AccountID: cashID}, userID)
	if err != nil {
		t.Fatal(err)
	}

	// Transfer: 300 from cash to savings
	_, err = model.Create(db, model.Transaction{
		Amount:      300,
		Type:        "transfer",
		AccountID:   cashID,
		ToAccountID: savings.ID,
	}, userID)
	if err != nil {
		t.Fatal(err)
	}

	accounts, err = model.ListAccounts(db, userID)
	if err != nil {
		t.Fatal(err)
	}

	balances := map[string]float64{}
	for _, a := range accounts {
		balances[a.ID] = a.Balance
	}

	if balances[cashID] != 700 {
		t.Errorf("expected Cash balance 700, got %.2f", balances[cashID])
	}
	if balances[savings.ID] != 300 {
		t.Errorf("expected Savings balance 300, got %.2f", balances[savings.ID])
	}
}

func TestCrossUserAccountIsolation(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	user1 := "acct-user-1"
	user2 := "acct-user-2"

	model.SeedDefaultAccountForUser(db, user1)
	model.SeedDefaultAccountForUser(db, user2)
	model.CreateAccount(db, model.Account{Name: "Extra", Type: "savings"}, user1)

	a1, _ := model.ListAccounts(db, user1)
	a2, _ := model.ListAccounts(db, user2)

	if len(a1) != 2 {
		t.Errorf("user1: expected 2 accounts, got %d", len(a1))
	}
	if len(a2) != 1 {
		t.Errorf("user2: expected 1 account, got %d", len(a2))
	}
}

func TestUpdateAccount(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	userID := "update-test-user"
	acct, err := model.CreateAccount(db, model.Account{Name: "Old Name", Type: "cash"}, userID)
	if err != nil {
		t.Fatal(err)
	}

	updated, err := model.UpdateAccount(db, acct.ID, "New Name", "savings", userID)
	if err != nil {
		t.Fatalf("UpdateAccount: %v", err)
	}
	if updated.Name != "New Name" {
		t.Errorf("expected name 'New Name', got %q", updated.Name)
	}
	if updated.Type != "savings" {
		t.Errorf("expected type 'savings', got %q", updated.Type)
	}

	// Verify via list
	accounts, _ := model.ListAccounts(db, userID)
	if len(accounts) != 1 {
		t.Fatalf("expected 1 account, got %d", len(accounts))
	}
	if accounts[0].Name != "New Name" {
		t.Errorf("expected name 'New Name' in list, got %q", accounts[0].Name)
	}
}

func TestDeleteAccount(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	userID := "delete-test-user"
	acct, err := model.CreateAccount(db, model.Account{Name: "Temp", Type: "cash"}, userID)
	if err != nil {
		t.Fatal(err)
	}

	err = model.DeleteAccount(db, acct.ID, userID)
	if err != nil {
		t.Fatalf("DeleteAccount: %v", err)
	}

	accounts, _ := model.ListAccounts(db, userID)
	if len(accounts) != 0 {
		t.Errorf("expected 0 accounts after delete, got %d", len(accounts))
	}
}

func TestDeleteAccountWithTransactions(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	userID := "delete-blocked-user"
	acct, err := model.CreateAccount(db, model.Account{Name: "Has Txns", Type: "cash"}, userID)
	if err != nil {
		t.Fatal(err)
	}

	_, err = model.Create(db, model.Transaction{Amount: 100, Type: "income", AccountID: acct.ID}, userID)
	if err != nil {
		t.Fatal(err)
	}

	err = model.DeleteAccount(db, acct.ID, userID)
	if !errors.Is(err, model.ErrAccountHasTransactions) {
		t.Errorf("expected ErrAccountHasTransactions, got %v", err)
	}

	// Account should still exist
	accounts, _ := model.ListAccounts(db, userID)
	if len(accounts) != 1 {
		t.Errorf("expected account to still exist, got %d accounts", len(accounts))
	}
}
