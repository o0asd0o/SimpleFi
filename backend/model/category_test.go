package model_test

import (
	"errors"
	"testing"

	"simple-fi/model"
	"simple-fi/store"
)

func TestSeedAndListCategories(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	userID := "cat-test-user"
	if err := model.SeedDefaultCategoriesForUser(db, userID); err != nil {
		t.Fatal(err)
	}

	cats, err := model.ListCategoriesForUser(db, userID)
	if err != nil {
		t.Fatalf("ListCategoriesForUser: %v", err)
	}
	if len(cats) != 6 {
		t.Fatalf("expected 6 default categories, got %d", len(cats))
	}

	// Check first and last
	if cats[0].Name != "Food" {
		t.Errorf("expected first category 'Food', got %q", cats[0].Name)
	}
	if cats[0].Icon != "🍔" {
		t.Errorf("expected icon '🍔', got %q", cats[0].Icon)
	}
	if cats[5].Name != "General" {
		t.Errorf("expected last category 'General', got %q", cats[5].Name)
	}
}

func TestCreateCategory(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	userID := "create-cat-user"
	cat, err := model.CreateCategory(db, "Health", "🏥", userID)
	if err != nil {
		t.Fatalf("CreateCategory: %v", err)
	}
	if cat.Name != "Health" {
		t.Errorf("expected name 'Health', got %q", cat.Name)
	}
	if cat.Icon != "🏥" {
		t.Errorf("expected icon '🏥', got %q", cat.Icon)
	}

	// Should appear in list
	cats, _ := model.ListCategoriesForUser(db, userID)
	if len(cats) != 1 {
		t.Fatalf("expected 1 category, got %d", len(cats))
	}
}

func TestUpdateCategory(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	userID := "update-cat-user"
	cat, _ := model.CreateCategory(db, "Old", "⭐", userID)

	updated, err := model.UpdateCategory(db, cat.ID, "New", "🌟")
	if err != nil {
		t.Fatalf("UpdateCategory: %v", err)
	}
	if updated.Name != "New" {
		t.Errorf("expected name 'New', got %q", updated.Name)
	}
	if updated.Icon != "🌟" {
		t.Errorf("expected icon '🌟', got %q", updated.Icon)
	}
}

func TestRemoveCategoryFromUser(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	userID := "remove-cat-user"
	cat, _ := model.CreateCategory(db, "Temp", "🗑️", userID)

	err = model.RemoveCategoryFromUser(db, cat.ID, userID)
	if err != nil {
		t.Fatalf("RemoveCategoryFromUser: %v", err)
	}

	cats, _ := model.ListCategoriesForUser(db, userID)
	if len(cats) != 0 {
		t.Errorf("expected 0 categories after remove, got %d", len(cats))
	}
}

func TestRemoveCategoryInUse(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	userID := "remove-blocked-user"
	cat, _ := model.CreateCategory(db, "Used", "📌", userID)

	// Create a transaction referencing this category
	_, err = model.Create(db, model.Transaction{
		Amount:     100,
		Type:       "expense",
		CategoryID: cat.ID,
	}, userID)
	if err != nil {
		t.Fatal(err)
	}

	err = model.RemoveCategoryFromUser(db, cat.ID, userID)
	if !errors.Is(err, model.ErrCategoryInUse) {
		t.Errorf("expected ErrCategoryInUse, got %v", err)
	}
}

func TestCrossUserCategoryIsolation(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	user1 := "cat-user-1"
	user2 := "cat-user-2"

	model.SeedDefaultCategoriesForUser(db, user1)
	model.CreateCategory(db, "Custom", "🎯", user1)

	// user2 has no categories
	cats2, _ := model.ListCategoriesForUser(db, user2)
	if len(cats2) != 0 {
		t.Errorf("user2: expected 0 categories, got %d", len(cats2))
	}

	cats1, _ := model.ListCategoriesForUser(db, user1)
	if len(cats1) != 7 { // 6 defaults + 1 custom
		t.Errorf("user1: expected 7 categories, got %d", len(cats1))
	}
}
