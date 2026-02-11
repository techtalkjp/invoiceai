-- better-auth tables for SQLite/Turso

CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "email_verified" INTEGER NOT NULL DEFAULT 0,
  "image" TEXT,
  "role" TEXT DEFAULT 'user',
  "banned" INTEGER DEFAULT 0,
  "ban_reason" TEXT,
  "ban_expires" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "token" TEXT NOT NULL UNIQUE,
  "expires_at" TEXT NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "account_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "access_token_expires_at" TEXT,
  "refresh_token_expires_at" TEXT,
  "scope" TEXT,
  "id_token" TEXT,
  "password" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expires_at" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Organization plugin tables
CREATE TABLE IF NOT EXISTS "organization" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT UNIQUE,
  "logo" TEXT,
  "metadata" TEXT,
  "freee_company_id" INTEGER,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "member" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL DEFAULT 'member',
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "invitation" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "inviter_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "team_id" TEXT,
  "expires_at" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "team" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "team_member" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "team_id" TEXT NOT NULL REFERENCES "team"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

-- App domain tables
CREATE TABLE IF NOT EXISTS "client" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "billing_type" TEXT NOT NULL CHECK ("billing_type" IN ('fixed', 'time')),
  "hourly_rate" INTEGER,
  "monthly_fee" INTEGER,
  "unit_label" TEXT DEFAULT '式',
  "has_work_description" INTEGER NOT NULL DEFAULT 1,
  "freee_partner_id" INTEGER,
  "freee_partner_name" TEXT,
  "invoice_subject_template" TEXT,
  "invoice_note" TEXT,
  "payment_terms" TEXT NOT NULL DEFAULT 'next_month_end' CHECK ("payment_terms" IN ('next_month_end', 'next_next_month_1st', 'next_next_month_end')),
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "monthly_status" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "client_id" TEXT NOT NULL REFERENCES "client"("id") ON DELETE CASCADE,
  "year_month" TEXT NOT NULL,
  "sent" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "invoice" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "client_id" TEXT NOT NULL REFERENCES "client"("id") ON DELETE CASCADE,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "year_month" TEXT NOT NULL,
  "billing_type_snapshot" TEXT NOT NULL CHECK ("billing_type_snapshot" IN ('fixed', 'time')),
  "hourly_rate_snapshot" INTEGER,
  "monthly_fee_snapshot" INTEGER,
  "subject_snapshot" TEXT,
  "note_snapshot" TEXT,
  "freee_invoice_id" INTEGER,
  "freee_invoice_number" TEXT,
  "billing_date" TEXT,
  "payment_date" TEXT,
  "amount_excluding_tax" INTEGER,
  "amount_tax" INTEGER,
  "total_amount" INTEGER,
  "status" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "invoice_line" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "invoice_id" TEXT NOT NULL REFERENCES "invoice"("id") ON DELETE CASCADE,
  "description" TEXT,
  "quantity" REAL,
  "unit" TEXT,
  "unit_price" INTEGER,
  "tax_rate" INTEGER
);

CREATE TABLE IF NOT EXISTS "work_entry" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "client_id" TEXT NOT NULL REFERENCES "client"("id") ON DELETE CASCADE,
  "user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "invoice_id" TEXT REFERENCES "invoice"("id") ON DELETE SET NULL,
  "work_date" TEXT NOT NULL,
  "start_time" TEXT,
  "end_time" TEXT,
  "break_minutes" INTEGER NOT NULL DEFAULT 0,
  "hours" REAL NOT NULL,
  "description" TEXT,
  "source_sheet" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "invoice_pdf" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "invoice_id" TEXT NOT NULL REFERENCES "invoice"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('freee', 'timesheet', 'merged')),
  "storage" TEXT NOT NULL,
  "path_or_key" TEXT NOT NULL,
  "sha256" TEXT,
  "bytes" INTEGER,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "provider_token" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "provider" TEXT NOT NULL CHECK ("provider" IN ('freee', 'google')),
  "access_token" TEXT,
  "refresh_token" TEXT,
  "expires_at" TEXT,
  "scope" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS "session_user_id_idx" ON "session"("user_id");
CREATE INDEX IF NOT EXISTS "session_token_idx" ON "session"("token");
CREATE INDEX IF NOT EXISTS "account_user_id_idx" ON "account"("user_id");
CREATE INDEX IF NOT EXISTS "account_provider_idx" ON "account"("provider_id", "account_id");
CREATE INDEX IF NOT EXISTS "member_org_id_idx" ON "member"("organization_id");
CREATE INDEX IF NOT EXISTS "member_user_id_idx" ON "member"("user_id");
CREATE INDEX IF NOT EXISTS "invitation_org_id_idx" ON "invitation"("organization_id");
CREATE INDEX IF NOT EXISTS "invitation_email_idx" ON "invitation"("email");
CREATE INDEX IF NOT EXISTS "team_org_id_idx" ON "team"("organization_id");
CREATE INDEX IF NOT EXISTS "team_member_team_id_idx" ON "team_member"("team_id");
CREATE INDEX IF NOT EXISTS "team_member_user_id_idx" ON "team_member"("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "client_org_name_idx" ON "client"("organization_id", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "client_org_partner_idx" ON "client"("organization_id", "freee_partner_id");
CREATE UNIQUE INDEX IF NOT EXISTS "monthly_status_unique_idx"
  ON "monthly_status"("organization_id", "client_id", "year_month");
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_org_freee_idx"
  ON "invoice"("organization_id", "freee_invoice_id");
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_org_client_month_idx"
  ON "invoice"("organization_id", "client_id", "year_month");
CREATE INDEX IF NOT EXISTS "invoice_client_idx" ON "invoice"("client_id");
CREATE INDEX IF NOT EXISTS "invoice_line_invoice_idx" ON "invoice_line"("invoice_id");
CREATE INDEX IF NOT EXISTS "work_entry_client_idx" ON "work_entry"("client_id");
CREATE INDEX IF NOT EXISTS "work_entry_user_idx" ON "work_entry"("user_id");
CREATE INDEX IF NOT EXISTS "work_entry_invoice_idx" ON "work_entry"("invoice_id");
CREATE INDEX IF NOT EXISTS "invoice_pdf_invoice_idx" ON "invoice_pdf"("invoice_id");
CREATE UNIQUE INDEX IF NOT EXISTS "provider_token_org_provider_idx"
  ON "provider_token"("organization_id", "provider");

-- Feature flags
CREATE TABLE IF NOT EXISTS "feature_flag" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "key" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "default_value" INTEGER NOT NULL DEFAULT 0,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "feature_flag_key_idx" ON "feature_flag"("key");

-- Activity source tables (AI auto-fill)
CREATE TABLE IF NOT EXISTS "activity_source" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "source_type" TEXT NOT NULL CHECK ("source_type" IN ('github', 'google_calendar', 'wakatime')),
  "credentials" TEXT NOT NULL,
  "config" TEXT,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "activity_source_org_user_type_idx"
  ON "activity_source"("organization_id", "user_id", "source_type");

CREATE TABLE IF NOT EXISTS "client_source_mapping" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "client_id" TEXT NOT NULL REFERENCES "client"("id") ON DELETE CASCADE,
  "source_type" TEXT NOT NULL,
  "source_identifier" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "client_source_mapping_unique_idx"
  ON "client_source_mapping"("client_id", "source_type", "source_identifier");

CREATE TABLE IF NOT EXISTS "activity" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "source_type" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "event_date" TEXT NOT NULL,
  "event_timestamp" TEXT NOT NULL,
  "repo" TEXT,
  "title" TEXT,
  "metadata" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "activity_org_user_date_idx"
  ON "activity"("organization_id", "user_id", "event_date");
CREATE INDEX IF NOT EXISTS "activity_source_type_idx"
  ON "activity"("organization_id", "user_id", "source_type");
CREATE UNIQUE INDEX IF NOT EXISTS "activity_unique_event_idx"
  ON "activity"("organization_id", "user_id", "source_type", "event_type", "event_timestamp", "repo");

-- Playground AI usage tracking
CREATE TABLE IF NOT EXISTS "playground_ai_usage" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "github_username" TEXT NOT NULL,
  "year_month" TEXT NOT NULL,
  "request_count" INTEGER NOT NULL DEFAULT 0,
  "total_input_tokens" INTEGER NOT NULL DEFAULT 0,
  "total_output_tokens" INTEGER NOT NULL DEFAULT 0,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "playground_ai_usage_user_month_idx"
  ON "playground_ai_usage"("github_username", "year_month");
