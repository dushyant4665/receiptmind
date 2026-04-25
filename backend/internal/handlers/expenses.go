package handlers

import (
	"database/sql"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/receiptmind/backend/internal/database"
	"github.com/receiptmind/backend/internal/models"
)

type ExpenseHandler struct {
	db *database.PostgresDB
}

func NewExpenseHandler(db *database.PostgresDB) *ExpenseHandler {
	return &ExpenseHandler{db: db}
}

func (h *ExpenseHandler) ListExpenses(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	rows, err := h.db.DB.Query(
		`SELECT id, user_id, receipt_id, vendor_name, amount, currency, expense_date, COALESCE(category, ''), COALESCE(description, ''), status, created_at, updated_at
		 FROM expenses WHERE user_id = $1 ORDER BY expense_date DESC LIMIT 100`,
		userID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch expenses"})
	}
	defer rows.Close()

	expenses := make([]models.Expense, 0)
	for rows.Next() {
		var expense models.Expense
		if err := rows.Scan(
			&expense.ID,
			&expense.UserID,
			&expense.ReceiptID,
			&expense.VendorName,
			&expense.Amount,
			&expense.Currency,
			&expense.Date,
			&expense.Category,
			&expense.Description,
			&expense.Status,
			&expense.CreatedAt,
			&expense.UpdatedAt,
		); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to read expenses"})
		}
		expenses = append(expenses, expense)
	}

	return c.JSON(expenses)
}

func (h *ExpenseHandler) CreateExpense(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	var req struct {
		ReceiptID   *uuid.UUID `json:"receipt_id"`
		VendorName  string     `json:"vendor_name"`
		Amount      float64    `json:"amount"`
		Currency    string     `json:"currency"`
		Date        string     `json:"date"`
		Category    string     `json:"category"`
		Description string     `json:"description"`
		Status      string     `json:"status"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	parsedDate, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid date format (expected YYYY-MM-DD)"})
	}
	if req.Currency == "" {
		req.Currency = "USD"
	}
	if req.Status == "" {
		req.Status = "pending"
	}

	expenseID := uuid.New()
	_, err = h.db.DB.Exec(
		`INSERT INTO expenses (id, user_id, receipt_id, vendor_name, amount, currency, expense_date, category, description, status, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())`,
		expenseID, userID, req.ReceiptID, req.VendorName, req.Amount, req.Currency, parsedDate, req.Category, req.Description, req.Status,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create expense"})
	}

	var expense models.Expense
	err = h.db.DB.QueryRow(
		`SELECT id, user_id, receipt_id, vendor_name, amount, currency, expense_date, COALESCE(category, ''), COALESCE(description, ''), status, created_at, updated_at
		 FROM expenses WHERE id = $1 AND user_id = $2`,
		expenseID, userID,
	).Scan(&expense.ID, &expense.UserID, &expense.ReceiptID, &expense.VendorName, &expense.Amount, &expense.Currency, &expense.Date, &expense.Category, &expense.Description, &expense.Status, &expense.CreatedAt, &expense.UpdatedAt)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to read expense"})
	}

	return c.Status(fiber.StatusCreated).JSON(expense)
}

func (h *ExpenseHandler) GetExpense(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	idParam := c.Params("id")
	expenseID, err := uuid.Parse(idParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid id"})
	}

	var expense models.Expense
	err = h.db.DB.QueryRow(
		`SELECT id, user_id, receipt_id, vendor_name, amount, currency, expense_date, COALESCE(category, ''), COALESCE(description, ''), status, created_at, updated_at
		 FROM expenses WHERE id = $1 AND user_id = $2`,
		expenseID, userID,
	).Scan(&expense.ID, &expense.UserID, &expense.ReceiptID, &expense.VendorName, &expense.Amount, &expense.Currency, &expense.Date, &expense.Category, &expense.Description, &expense.Status, &expense.CreatedAt, &expense.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch expense"})
	}

	return c.JSON(expense)
}

func (h *ExpenseHandler) UpdateExpense(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	idParam := c.Params("id")
	expenseID, err := uuid.Parse(idParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid id"})
	}

	var req struct {
		VendorName  string  `json:"vendor_name"`
		Amount      float64 `json:"amount"`
		Currency    string  `json:"currency"`
		Date        string  `json:"date"`
		Category    string  `json:"category"`
		Description string  `json:"description"`
		Status      string  `json:"status"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	parsedDate, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid date format (expected YYYY-MM-DD)"})
	}
	if req.Currency == "" {
		req.Currency = "USD"
	}
	if req.Status == "" {
		req.Status = "pending"
	}

	res, err := h.db.DB.Exec(
		`UPDATE expenses SET vendor_name=$1, amount=$2, currency=$3, expense_date=$4, category=$5, description=$6, status=$7, updated_at=NOW() WHERE id=$8 AND user_id=$9`,
		req.VendorName, req.Amount, req.Currency, parsedDate, req.Category, req.Description, req.Status, expenseID, userID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update expense"})
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Not found"})
	}

	return h.GetExpense(c)
}

func (h *ExpenseHandler) DeleteExpense(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	idParam := c.Params("id")
	expenseID, err := uuid.Parse(idParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid id"})
	}

	res, err := h.db.DB.Exec(`DELETE FROM expenses WHERE id = $1 AND user_id = $2`, expenseID, userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete expense"})
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Not found"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}
