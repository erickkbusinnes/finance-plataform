CREATE TABLE users (
 id uuid PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
 password_hash text NOT NULL, email_verified boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE auth_tokens (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE, purpose text NOT NULL CHECK(purpose IN ('verify','reset')),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE mail_outbox (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
 kind text NOT NULL, recipient text NOT NULL, token text, delivered_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE workspaces (
 id uuid PRIMARY KEY, name text NOT NULL, kind text NOT NULL CHECK(kind IN ('personal','business')),
 currency text NOT NULL DEFAULT 'BRL' CHECK(currency='BRL'), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE workspace_members (
 workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('owner','admin','finance','viewer')),
 PRIMARY KEY(workspace_id,user_id)
);
CREATE INDEX membership_user ON workspace_members(user_id);
CREATE TABLE financial_accounts (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 name text NOT NULL, type text NOT NULL CHECK(type IN ('checking','savings','cash','wallet','investment')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workspace_id,id)
);
CREATE TABLE categories (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 name text NOT NULL, kind text NOT NULL CHECK(kind IN ('income','expense')),color text NOT NULL,
 UNIQUE(workspace_id,id),UNIQUE(workspace_id,name,kind)
);
CREATE TABLE transactions (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 description text NOT NULL, kind text NOT NULL CHECK(kind IN ('opening','income','expense','transfer')),
 amount_cents bigint NOT NULL CHECK(amount_cents>0 AND amount_cents<=1000000000000),
 date date NOT NULL, account_id uuid NOT NULL, destination_account_id uuid,
 category_id uuid, notes text NOT NULL DEFAULT '', version integer NOT NULL DEFAULT 1,
 idempotency_key uuid NOT NULL, voided_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,account_id) REFERENCES financial_accounts(workspace_id,id),
 FOREIGN KEY(workspace_id,destination_account_id) REFERENCES financial_accounts(workspace_id,id),
 FOREIGN KEY(workspace_id,category_id) REFERENCES categories(workspace_id,id),
 CHECK((kind='transfer' AND destination_account_id IS NOT NULL AND destination_account_id<>account_id AND category_id IS NULL) OR (kind<>'transfer' AND destination_account_id IS NULL)),
 UNIQUE(workspace_id,id),UNIQUE(workspace_id,idempotency_key)
);
CREATE INDEX transactions_workspace_date ON transactions(workspace_id,date DESC,created_at DESC);
CREATE TABLE transaction_entries (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, transaction_id uuid NOT NULL,
 account_id uuid NOT NULL, amount_cents bigint NOT NULL CHECK(amount_cents<>0 AND abs(amount_cents)<=1000000000000),
 FOREIGN KEY(workspace_id,transaction_id) REFERENCES transactions(workspace_id,id) ON DELETE CASCADE,
 FOREIGN KEY(workspace_id,account_id) REFERENCES financial_accounts(workspace_id,id),UNIQUE(transaction_id,account_id)
);
CREATE INDEX entries_account ON transaction_entries(workspace_id,account_id);
CREATE TABLE budgets (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 category_id uuid NOT NULL, month date NOT NULL CHECK(extract(day FROM month)=1),
 limit_cents bigint NOT NULL CHECK(limit_cents>0 AND limit_cents<=1000000000000),
 FOREIGN KEY(workspace_id,category_id) REFERENCES categories(workspace_id,id),UNIQUE(workspace_id,category_id,month)
);
CREATE TABLE goals (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 name text NOT NULL,target_cents bigint NOT NULL CHECK(target_cents>0 AND target_cents<=1000000000000),due_date date,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(workspace_id,id)
);
CREATE TABLE goal_contributions (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, goal_id uuid NOT NULL,
 amount_cents bigint NOT NULL CHECK(amount_cents>0 AND amount_cents<=1000000000000),
 idempotency_key uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,goal_id) REFERENCES goals(workspace_id,id) ON DELETE CASCADE,
 UNIQUE(workspace_id,idempotency_key)
);
CREATE TABLE audit_logs (
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES users,action text NOT NULL,entity_id uuid NOT NULL,
 before_data jsonb,after_data jsonb,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_workspace ON audit_logs(workspace_id,created_at DESC);
CREATE TABLE contact_messages (
 id uuid PRIMARY KEY,name text NOT NULL,email text NOT NULL,message text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
