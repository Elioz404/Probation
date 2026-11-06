import {
  createSharesTable,
  ownableColumns,
} from "@agent-native/core/db/schema";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** One agent on probation against one repository's history. */
export const probations = pgTable("probations", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  examRepo: text("exam_repo").notNull(),
  workRepo: text("work_repo"),
  /** JSON `TrustPolicy`, parsed through its schema on every read. */
  policy: text("policy").notNull(),
  /** JSON `Record<Disposition, number>`: closed issues per outcome on GitHub. */
  populations: text("populations"),
  /** JSON string[]: the repository's label vocabulary, given to the examinee. */
  labelCatalog: text("label_catalog").notNull().default("[]"),
  /** Label that marks an accepted issue on the work repository. */
  triagedLabel: text("triaged_label").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  ...ownableColumns(),
});

export const probationShares = createSharesTable("probation_shares");

/**
 * A graded decision. `truth*` columns are what the agent is being examined on
 * and must never reach it before `answeredAt` is set.
 */
export const examCases = pgTable(
  "exam_cases",
  {
    id: text("id").primaryKey(),
    probationId: text("probation_id")
      .notNull()
      .references(() => probations.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    issueNumber: integer("issue_number").notNull(),
    issueUrl: text("issue_url").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    context: text("context").notNull(),
    weight: doublePrecision("weight").notNull(),
    truthDisposition: text("truth_disposition").notNull(),
    truthLabels: text("truth_labels").notNull().default("[]"),
    answerDisposition: text("answer_disposition"),
    answerLabels: text("answer_labels"),
    answerConfidence: doublePrecision("answer_confidence"),
    answerRationale: text("answer_rationale"),
    dispositionCorrect: boolean("disposition_correct"),
    labelsCorrect: boolean("labels_correct"),
    contested: boolean("contested").notNull().default(false),
    answeredAt: text("answered_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("exam_cases_probation_answered_idx").on(
      table.probationId,
      table.answeredAt,
    ),
    uniqueIndex("exam_cases_history_issue_idx").on(
      table.probationId,
      table.source,
      table.issueNumber,
    ),
  ],
);

/** The level a person granted. A missing row means `observe`. */
export const trustCells = pgTable(
  "trust_cells",
  {
    probationId: text("probation_id")
      .notNull()
      .references(() => probations.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    context: text("context").notNull(),
    level: text("level").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.probationId, table.action, table.context] }),
  ],
);

/** Append-only history of every change to a granted level. */
export const trustEvents = pgTable(
  "trust_events",
  {
    id: text("id").primaryKey(),
    probationId: text("probation_id")
      .notNull()
      .references(() => probations.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    context: text("context").notNull(),
    fromLevel: text("from_level").notNull(),
    toLevel: text("to_level").notNull(),
    kind: text("kind").notNull(),
    actor: text("actor").notNull(),
    reason: text("reason").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("trust_events_probation_created_idx").on(
      table.probationId,
      table.createdAt,
    ),
  ],
);

/** The agent asking for more autonomy, with evidence computed by code. */
export const promotionRequests = pgTable(
  "promotion_requests",
  {
    id: text("id").primaryKey(),
    probationId: text("probation_id")
      .notNull()
      .references(() => probations.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    context: text("context").notNull(),
    toLevel: text("to_level").notNull(),
    argument: text("argument").notNull(),
    /** JSON `PromotionEvidence`, snapshotted when the request was filed. */
    evidence: text("evidence").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    decidedAt: text("decided_at"),
  },
  (table) => [
    index("promotion_requests_probation_status_idx").on(
      table.probationId,
      table.status,
    ),
  ],
);

/** A live issue on the work repository and the agent's handling of it. */
export const workItems = pgTable(
  "work_items",
  {
    id: text("id").primaryKey(),
    probationId: text("probation_id")
      .notNull()
      .references(() => probations.id, { onDelete: "cascade" }),
    issueNumber: integer("issue_number").notNull(),
    issueUrl: text("issue_url").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    context: text("context").notNull(),
    status: text("status").notNull(),
    proposedDisposition: text("proposed_disposition"),
    proposedLabels: text("proposed_labels"),
    proposedConfidence: doublePrecision("proposed_confidence"),
    proposedRationale: text("proposed_rationale"),
    /** The level in force when the proposal was carried out. */
    executedAtLevel: text("executed_at_level"),
    executedBy: text("executed_by"),
    overruleNote: text("overrule_note"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("work_items_issue_idx").on(
      table.probationId,
      table.issueNumber,
    ),
    index("work_items_probation_status_idx").on(
      table.probationId,
      table.status,
    ),
  ],
);
