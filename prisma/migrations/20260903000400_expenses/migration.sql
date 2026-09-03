CREATE TYPE "ExpenseCategory" AS ENUM ('PARTS_AND_SUPPLIES', 'PERSONNEL', 'RENT', 'UTILITIES', 'TAXES', 'FINANCIAL_FEES', 'MAINTENANCE', 'MARKETING', 'OTHER');
CREATE TYPE "ExpenseStatus" AS ENUM ('OPEN', 'CANCELLED');

CREATE TABLE "Expense" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExpensePayment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "expenseId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "paidAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpensePayment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Expense_organizationId_id_key" ON "Expense"("organizationId", "id");
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_organizationId_expenseId_fkey" FOREIGN KEY ("organizationId", "expenseId") REFERENCES "Expense"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Expense_organizationId_status_dueDate_idx" ON "Expense"("organizationId", "status", "dueDate");
CREATE INDEX "Expense_organizationId_category_idx" ON "Expense"("organizationId", "category");
CREATE INDEX "ExpensePayment_organizationId_expenseId_status_idx" ON "ExpensePayment"("organizationId", "expenseId", "status");
CREATE INDEX "ExpensePayment_organizationId_paidAt_idx" ON "ExpensePayment"("organizationId", "paidAt");
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_amount_positive" CHECK ("amount" > 0);
