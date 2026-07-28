// Command seed populates the database with two demo users, a shared
// partnership, and thousands of realistic transactions for demoing the app.
package main

import (
	"database/sql"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"time"

	"github.com/google/uuid"

	"simple-fi/model"
	"simple-fi/store"
)

type demoUser struct {
	username string
	password string
	name     string
}

var demoUsers = []demoUser{
	{"demo_alex", "DemoPass123!", "Alex Rivera"},
	{"demo_sam", "DemoPass123!", "Sam Chen"},
}

// expenseCategory -> [min, max] typical amount range.
var expenseRanges = map[string][2]float64{
	"cat-food":          {5, 80},
	"cat-transport":     {3, 60},
	"cat-bills":         {20, 250},
	"cat-entertainment": {10, 120},
	"cat-general":       {5, 100},
	"cat-card-payment":  {50, 500},
}

var incomeRanges = map[string][2]float64{
	"cat-salary": {1800, 3200},
	"cat-gift":   {20, 300},
	"cat-others": {10, 200},
}

var descriptions = map[string][]string{
	"cat-food":          {"Groceries", "Coffee shop", "Lunch out", "Dinner delivery", "Snacks"},
	"cat-transport":     {"Gas", "Ride share", "Train ticket", "Parking", "Bike rental"},
	"cat-bills":         {"Electricity bill", "Internet bill", "Phone bill", "Rent", "Water bill"},
	"cat-entertainment": {"Movie night", "Concert ticket", "Streaming subscription", "Games", "Books"},
	"cat-general":       {"Misc purchase", "Pharmacy", "Household items"},
	"cat-card-payment":  {"Credit card payment"},
	"cat-salary":        {"Monthly salary"},
	"cat-gift":          {"Birthday gift", "Cash gift"},
	"cat-others":        {"Refund", "Side hustle"},
}

func main() {
	dbPath := flag.String("db", "data.db", "path to sqlite db")
	perUser := flag.Int("count", 1500, "transactions to generate per user")
	months := flag.Int("months", 18, "months of history to spread transactions across")
	flag.Parse()

	db, err := store.New(*dbPath)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	rng := rand.New(rand.NewSource(42))

	users := make([]model.User, 0, len(demoUsers))
	for _, du := range demoUsers {
		u, existing, err := getOrRegister(db, du)
		if err != nil {
			log.Fatalf("register %s: %v", du.username, err)
		}
		users = append(users, u)
		if existing {
			fmt.Printf("user %s already exists, reusing\n", du.username)
		} else {
			fmt.Printf("created user %s / %s (%s)\n", du.username, du.password, u.Name)
		}
	}

	if err := ensurePartnership(db, users[0].ID, users[1].ID); err != nil {
		log.Fatalf("link partnership: %v", err)
	}
	fmt.Println("linked partnership between demo users")

	for i, u := range users {
		bankAcct, err := ensureBankAccount(db, u.ID)
		if err != nil {
			log.Fatalf("bank account for %s: %v", u.Username, err)
		}
		cashAcct, err := getCashAccount(db, u.ID)
		if err != nil {
			log.Fatalf("cash account for %s: %v", u.Username, err)
		}

		n, err := seedTransactions(db, rng, u.ID, []string{cashAcct, bankAcct}, *perUser, *months)
		if err != nil {
			log.Fatalf("seed transactions for %s: %v", u.Username, err)
		}
		fmt.Printf("seeded %d transactions for %s (user %d/%d)\n", n, u.Username, i+1, len(users))
	}

	fmt.Println("done. Login with either demo account to see the data.")
}

func getOrRegister(db *sql.DB, du demoUser) (model.User, bool, error) {
	if u, err := getUserByUsername(db, du.username); err == nil {
		return u, true, nil
	}
	u, _, err := model.Register(db, du.username, du.password, du.name)
	return u, false, err
}

func getUserByUsername(db *sql.DB, username string) (model.User, error) {
	var u model.User
	var createdAt string
	err := db.QueryRow(
		"SELECT id, username, name, created_at FROM users WHERE username = ?", username,
	).Scan(&u.ID, &u.Username, &u.Name, &createdAt)
	if err != nil {
		return model.User{}, err
	}
	u.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	return u, nil
}

func ensurePartnership(db *sql.DB, userA, userB string) error {
	var count int
	err := db.QueryRow(`
		SELECT COUNT(*) FROM partnership_members pm1
		JOIN partnership_members pm2 ON pm1.partnership_id = pm2.partnership_id
		WHERE pm1.user_id = ? AND pm2.user_id = ?
	`, userA, userB).Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	p, err := model.CreatePartnership(db, "Demo Household", "couple", userA)
	if err != nil {
		return err
	}
	_, err = db.Exec(
		`INSERT INTO partnership_members (partnership_id, user_id, status, joined_at) VALUES (?, ?, 'active', ?)`,
		p.ID, userB, time.Now().UTC().Format(time.RFC3339),
	)
	return err
}

func getCashAccount(db *sql.DB, userID string) (string, error) {
	var id string
	err := db.QueryRow(`SELECT id FROM accounts WHERE user_id = ? AND type = 'cash' LIMIT 1`, userID).Scan(&id)
	return id, err
}

func ensureBankAccount(db *sql.DB, userID string) (string, error) {
	var id string
	err := db.QueryRow(`SELECT id FROM accounts WHERE user_id = ? AND type = 'bank' LIMIT 1`, userID).Scan(&id)
	if err == nil {
		return id, nil
	}
	acct, err := model.CreateAccount(db, model.Account{Name: "Bank", Type: "bank"}, userID)
	if err != nil {
		return "", err
	}
	return acct.ID, nil
}

func seedTransactions(db *sql.DB, rng *rand.Rand, userID string, accountIDs []string, count, months int) (int, error) {
	txn, err := db.Begin()
	if err != nil {
		return 0, err
	}
	defer txn.Rollback()

	stmt, err := txn.Prepare(`
		INSERT INTO transactions (id, amount, type, category, category_id, description, account_id, user_id, status, created_at)
		VALUES (?, ?, ?, '', ?, ?, ?, ?, 'confirmed', ?)
	`)
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	now := time.Now().UTC()
	start := now.AddDate(0, -months, 0)
	span := now.Sub(start)

	expenseCats := keys(expenseRanges)
	incomeCats := keys(incomeRanges)

	for i := 0; i < count; i++ {
		createdAt := start.Add(time.Duration(rng.Int63n(int64(span))))
		accountID := accountIDs[rng.Intn(len(accountIDs))]

		var catID string
		var isIncome bool
		if rng.Intn(100) < 12 { // ~12% income, rest expenses
			isIncome = true
			catID = incomeCats[rng.Intn(len(incomeCats))]
		} else {
			catID = expenseCats[rng.Intn(len(expenseCats))]
		}

		var amount float64
		if isIncome {
			r := incomeRanges[catID]
			amount = round2(r[0] + rng.Float64()*(r[1]-r[0]))
		} else {
			r := expenseRanges[catID]
			amount = round2(r[0] + rng.Float64()*(r[1]-r[0]))
		}

		txType := "expense"
		if isIncome {
			txType = "income"
		}
		descs := descriptions[catID]
		desc := descs[rng.Intn(len(descs))]

		_, err := stmt.Exec(
			uuid.NewString(), amount, txType, catID, desc, accountID, userID,
			createdAt.Format(time.RFC3339),
		)
		if err != nil {
			return i, err
		}
	}

	if err := txn.Commit(); err != nil {
		return 0, err
	}
	return count, nil
}

func keys(m map[string][2]float64) []string {
	ks := make([]string, 0, len(m))
	for k := range m {
		ks = append(ks, k)
	}
	return ks
}

func round2(f float64) float64 {
	return float64(int(f*100)) / 100
}
