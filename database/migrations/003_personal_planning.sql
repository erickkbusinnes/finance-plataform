CREATE TABLE credit_cards (
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 name text NOT NULL,limit_cents bigint NOT NULL CHECK(limit_cents>0 AND limit_cents<=1000000000000),
 closing_day integer NOT NULL CHECK(closing_day BETWEEN 1 AND 31),due_day integer NOT NULL CHECK(due_day BETWEEN 1 AND 31),
 version integer NOT NULL DEFAULT 1,archived_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(workspace_id,id)
);
CREATE TABLE card_statements (
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,card_id uuid NOT NULL,due_date date NOT NULL,closing_date date NOT NULL,
 settled_at timestamptz,settlement_date date,cash_transaction_id uuid,payment_key uuid,paid_cents bigint NOT NULL DEFAULT 0 CHECK(paid_cents>=0),
 FOREIGN KEY(workspace_id,card_id) REFERENCES credit_cards(workspace_id,id) ON DELETE CASCADE,
 FOREIGN KEY(workspace_id,cash_transaction_id) REFERENCES transactions(workspace_id,id),
 UNIQUE(card_id,due_date),UNIQUE(workspace_id,id),UNIQUE(workspace_id,payment_key)
);
CREATE INDEX statements_card_date ON card_statements(workspace_id,card_id,due_date);
CREATE TABLE card_purchases (
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,card_id uuid NOT NULL,description text NOT NULL,
 amount_cents bigint NOT NULL CHECK(amount_cents>0 AND amount_cents<=1000000000000),date date NOT NULL,
 installments integer NOT NULL CHECK(installments BETWEEN 1 AND 120),category_id uuid,idempotency_key uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,card_id) REFERENCES credit_cards(workspace_id,id) ON DELETE CASCADE,
 FOREIGN KEY(workspace_id,category_id) REFERENCES categories(workspace_id,id),UNIQUE(workspace_id,id),UNIQUE(workspace_id,idempotency_key)
);
CREATE TABLE card_installments (
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,purchase_id uuid NOT NULL,statement_id uuid NOT NULL,
 number integer NOT NULL CHECK(number>0),amount_cents bigint NOT NULL CHECK(amount_cents>0),
 FOREIGN KEY(workspace_id,purchase_id) REFERENCES card_purchases(workspace_id,id) ON DELETE CASCADE,
 FOREIGN KEY(workspace_id,statement_id) REFERENCES card_statements(workspace_id,id) ON DELETE CASCADE,
 UNIQUE(purchase_id,number)
);
CREATE INDEX installments_statement ON card_installments(workspace_id,statement_id);
CREATE TABLE card_refunds (
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,purchase_id uuid NOT NULL,statement_id uuid NOT NULL,
 amount_cents bigint NOT NULL CHECK(amount_cents>0 AND amount_cents<=1000000000000),date date NOT NULL,reason text NOT NULL,
 idempotency_key uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,purchase_id) REFERENCES card_purchases(workspace_id,id) ON DELETE CASCADE,
 FOREIGN KEY(workspace_id,statement_id) REFERENCES card_statements(workspace_id,id) ON DELETE CASCADE,
 UNIQUE(workspace_id,idempotency_key)
);
CREATE TABLE card_credit_entries (
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,card_id uuid NOT NULL,statement_id uuid NOT NULL,amount_cents bigint NOT NULL CHECK(amount_cents<>0),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,card_id) REFERENCES credit_cards(workspace_id,id) ON DELETE CASCADE,
 FOREIGN KEY(workspace_id,statement_id) REFERENCES card_statements(workspace_id,id) ON DELETE CASCADE,
 UNIQUE(statement_id)
);
CREATE TABLE debts (
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 creditor text NOT NULL,principal_cents bigint NOT NULL CHECK(principal_cents>0 AND principal_cents<=1000000000000),
 monthly_interest_bps integer NOT NULL DEFAULT 0 CHECK(monthly_interest_bps BETWEEN 0 AND 100000),
 date date NOT NULL,due_date date,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(workspace_id,id)
);
CREATE TABLE debt_payments (
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,debt_id uuid NOT NULL,principal_cents bigint NOT NULL CHECK(principal_cents>0),interest_cents bigint NOT NULL CHECK(interest_cents>=0),date date NOT NULL,
 transaction_id uuid NOT NULL,idempotency_key uuid NOT NULL,voided_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,debt_id) REFERENCES debts(workspace_id,id) ON DELETE CASCADE,
 FOREIGN KEY(workspace_id,transaction_id) REFERENCES transactions(workspace_id,id),UNIQUE(workspace_id,idempotency_key)
);
CREATE INDEX debt_payments_debt ON debt_payments(workspace_id,debt_id);
CREATE TABLE holdings (
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 name text NOT NULL,kind text NOT NULL CHECK(kind IN ('asset','investment')),subtype text NOT NULL,
 quantity numeric(24,8) NOT NULL CHECK(quantity>0),applied_cents bigint NOT NULL CHECK(applied_cents>=0 AND applied_cents<=1000000000000),
 linked_account_id uuid,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,linked_account_id) REFERENCES financial_accounts(workspace_id,id),UNIQUE(workspace_id,id),UNIQUE(workspace_id,linked_account_id)
);
CREATE TABLE holding_valuations (
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,holding_id uuid NOT NULL,value_cents bigint NOT NULL CHECK(value_cents>=0 AND value_cents<=1000000000000),date date NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,holding_id) REFERENCES holdings(workspace_id,id) ON DELETE CASCADE
);
CREATE INDEX valuations_latest ON holding_valuations(workspace_id,holding_id,date DESC,created_at DESC,id DESC);
