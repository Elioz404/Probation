import { runMigrations } from "@agent-native/core/db";

export default runMigrations(
  [
    {
      version: 1,
      name: "create-probations",
      sql: `
        CREATE TABLE IF NOT EXISTS probations (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          exam_repo TEXT NOT NULL,
          work_repo TEXT,
          policy TEXT NOT NULL,
          populations TEXT,
          label_catalog TEXT NOT NULL DEFAULT '[]',
          triaged_label TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          owner_email TEXT NOT NULL DEFAULT 'local@localhost',
          org_id TEXT,
          visibility TEXT NOT NULL DEFAULT 'private'
        );
        CREATE INDEX IF NOT EXISTS probations_owner_idx ON probations (owner_email);
        CREATE TABLE IF NOT EXISTS probation_shares (
          id TEXT PRIMARY KEY,
          resource_id TEXT NOT NULL,
          principal_type TEXT NOT NULL,
          principal_id TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'viewer',
          created_by TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT now(),
          notified_at TEXT
        );
        CREATE INDEX IF NOT EXISTS probation_shares_resource_idx ON probation_shares (resource_id);
      `,
    },
    {
      version: 2,
      name: "create-exam-cases",
      sql: `
        CREATE TABLE IF NOT EXISTS exam_cases (
          id TEXT PRIMARY KEY,
          probation_id TEXT NOT NULL REFERENCES probations(id) ON DELETE CASCADE,
          source TEXT NOT NULL,
          issue_number INTEGER NOT NULL,
          issue_url TEXT NOT NULL,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          context TEXT NOT NULL,
          weight DOUBLE PRECISION NOT NULL,
          truth_disposition TEXT NOT NULL,
          truth_labels TEXT NOT NULL DEFAULT '[]',
          answer_disposition TEXT,
          answer_labels TEXT,
          answer_confidence DOUBLE PRECISION,
          answer_rationale TEXT,
          disposition_correct BOOLEAN,
          labels_correct BOOLEAN,
          contested BOOLEAN NOT NULL DEFAULT FALSE,
          answered_at TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS exam_cases_probation_answered_idx ON exam_cases (probation_id, answered_at);
        CREATE UNIQUE INDEX IF NOT EXISTS exam_cases_history_issue_idx ON exam_cases (probation_id, source, issue_number);
      `,
    },
    {
      version: 3,
      name: "create-trust-map",
      sql: `
        CREATE TABLE IF NOT EXISTS trust_cells (
          probation_id TEXT NOT NULL REFERENCES probations(id) ON DELETE CASCADE,
          action TEXT NOT NULL,
          context TEXT NOT NULL,
          level TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (probation_id, action, context)
        );
        CREATE TABLE IF NOT EXISTS trust_events (
          id TEXT PRIMARY KEY,
          probation_id TEXT NOT NULL REFERENCES probations(id) ON DELETE CASCADE,
          action TEXT NOT NULL,
          context TEXT NOT NULL,
          from_level TEXT NOT NULL,
          to_level TEXT NOT NULL,
          kind TEXT NOT NULL,
          actor TEXT NOT NULL,
          reason TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS trust_events_probation_created_idx ON trust_events (probation_id, created_at);
        CREATE TABLE IF NOT EXISTS promotion_requests (
          id TEXT PRIMARY KEY,
          probation_id TEXT NOT NULL REFERENCES probations(id) ON DELETE CASCADE,
          action TEXT NOT NULL,
          context TEXT NOT NULL,
          to_level TEXT NOT NULL,
          argument TEXT NOT NULL,
          evidence TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          decided_at TEXT
        );
        CREATE INDEX IF NOT EXISTS promotion_requests_probation_status_idx ON promotion_requests (probation_id, status);
        CREATE UNIQUE INDEX IF NOT EXISTS promotion_requests_one_pending_idx ON promotion_requests (probation_id, action, context) WHERE status = 'pending';
      `,
    },
    {
      version: 4,
      name: "create-work-items",
      sql: `
        CREATE TABLE IF NOT EXISTS work_items (
          id TEXT PRIMARY KEY,
          probation_id TEXT NOT NULL REFERENCES probations(id) ON DELETE CASCADE,
          issue_number INTEGER NOT NULL,
          issue_url TEXT NOT NULL,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          context TEXT NOT NULL,
          status TEXT NOT NULL,
          proposed_disposition TEXT,
          proposed_labels TEXT,
          proposed_confidence DOUBLE PRECISION,
          proposed_rationale TEXT,
          executed_at_level TEXT,
          executed_by TEXT,
          overrule_note TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS work_items_issue_idx ON work_items (probation_id, issue_number);
        CREATE INDEX IF NOT EXISTS work_items_probation_status_idx ON work_items (probation_id, status);
      `,
    },
  ],
  { table: "probation_migrations" },
);
