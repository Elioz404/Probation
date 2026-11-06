import { randomUUID } from "node:crypto";

import { fail } from "@agent-native/core/action";
import { defineMachine } from "@agent-native/core/state-machine";
import { and, desc, eq, inArray } from "drizzle-orm";

import type { WorkItemView } from "../../shared/contracts.js";
import { matchLabels } from "../../shared/github/labels.js";
import { classifyIssueContext } from "../../shared/trust/context.js";
import {
  actorSchema,
  dispositionSchema,
  issueContextSchema,
  levelRank,
  trustLevelSchema,
  type Actor,
  type CellKey,
  type Disposition,
  type TrustLevel,
} from "../../shared/trust/model.js";
import { getDb, schema } from "../db/index.js";
import type { GitHubClient } from "../github/client.js";
import { clipIssueBody } from "./exam.js";
import { parseStringList, policyOf, type ProbationRow } from "./probations.js";
import { demoteCell, grantedLevelOf, loadCell } from "./trust-map.js";

const { examCases, probations, workItems } = schema;

export const workMachine = defineMachine({
  id: "work-item",
  states: ["new", "proposed", "executed", "overruled"],
  initial: "new",
  terminal: ["overruled"],
  transitions: {
    propose: { from: ["new", "proposed"], to: "proposed" },
    execute: { from: ["proposed"], to: "executed" },
    overrule: { from: ["proposed", "executed"], to: "overruled" },
  },
});

type WorkItemRow = typeof workItems.$inferSelect;

/** GitHub lists pull requests as issues, so read a full page to find enough. */
const ISSUES_PER_SYNC = 100;

function requireWorkRepo(probation: ProbationRow): string {
  if (!probation.workRepo) {
    fail("This probation has no work repository yet.", {
      errorCode: "no_work_repo",
      statusCode: 412,
    });
  }
  return probation.workRepo;
}

function isClosing(
  disposition: Disposition,
): disposition is Exclude<Disposition, "accept"> {
  return disposition !== "accept";
}

/** Every trust-map cell a proposal needs. Autonomy is its weakest link. */
function cellsOfProposal(
  context: string,
  disposition: Disposition,
  labels: readonly string[],
): CellKey[] {
  const parsedContext = issueContextSchema.parse(context);
  const cells: CellKey[] = [{ action: disposition, context: parsedContext }];
  if (labels.length > 0) {
    cells.push({ action: "apply-labels", context: parsedContext });
  }
  return cells;
}

async function levelOfProposal(
  probationId: string,
  context: string,
  disposition: Disposition,
  labels: readonly string[],
): Promise<TrustLevel> {
  const levels = await Promise.all(
    cellsOfProposal(context, disposition, labels).map((key) =>
      grantedLevelOf(probationId, key),
    ),
  );
  return levels.reduce((lowest, level) =>
    levelRank(level) < levelRank(lowest) ? level : lowest,
  );
}

async function viewOf(item: WorkItemRow): Promise<WorkItemView> {
  const proposedDisposition = item.proposedDisposition
    ? dispositionSchema.parse(item.proposedDisposition)
    : null;
  const proposedLabels = parseStringList(item.proposedLabels);
  return {
    id: item.id,
    issueNumber: item.issueNumber,
    issueUrl: item.issueUrl,
    title: item.title,
    context: issueContextSchema.parse(item.context),
    status: workMachine.parseState(item.status),
    proposedDisposition,
    proposedLabels,
    proposedConfidence: item.proposedConfidence,
    proposedRationale: item.proposedRationale,
    currentLevel: proposedDisposition
      ? await levelOfProposal(
          item.probationId,
          item.context,
          proposedDisposition,
          proposedLabels,
        )
      : null,
    executedAtLevel: item.executedAtLevel
      ? trustLevelSchema.parse(item.executedAtLevel)
      : null,
    executedBy: item.executedBy ? actorSchema.parse(item.executedBy) : null,
    overruleNote: item.overruleNote,
    createdAt: item.createdAt,
  };
}

export async function listWorkItems(
  probationId: string,
): Promise<WorkItemView[]> {
  const rows = await getDb()
    .select()
    .from(workItems)
    .where(eq(workItems.probationId, probationId))
    .orderBy(desc(workItems.issueNumber));
  return Promise.all(rows.map(viewOf));
}

export async function syncWorkIssues(
  probation: ProbationRow,
  github: GitHubClient,
) {
  const repo = requireWorkRepo(probation);
  const [issues, labels] = await Promise.all([
    github.listOpenIssues(repo, ISSUES_PER_SYNC),
    github.listLabels(repo),
  ]);
  await getDb()
    .update(probations)
    .set({ workLabelCatalog: JSON.stringify(labels) })
    .where(eq(probations.id, probation.id));
  if (issues.length === 0) return { added: 0 };
  const now = new Date().toISOString();
  const inserted = await getDb()
    .insert(workItems)
    .values(
      issues.map((issue) => {
        const body = clipIssueBody(issue.body);
        return {
          id: randomUUID(),
          probationId: probation.id,
          issueNumber: issue.number,
          issueUrl: issue.url,
          title: issue.title,
          body,
          context: classifyIssueContext({
            authorAssociation: issue.authorAssociation,
            body,
          }),
          status: workMachine.initial,
          createdAt: now,
          updatedAt: now,
        };
      }),
    )
    .onConflictDoNothing()
    .returning({ id: workItems.id });
  return { added: inserted.length };
}

async function loadItem(
  probationId: string,
  workItemId: string,
): Promise<WorkItemRow> {
  const [item] = await getDb()
    .select()
    .from(workItems)
    .where(
      and(eq(workItems.id, workItemId), eq(workItems.probationId, probationId)),
    )
    .limit(1);
  if (!item) {
    fail("Work item not found.", { errorCode: "not_found", statusCode: 404 });
  }
  return item;
}

/**
 * What an agent reads to form a proposal: the issue, which is untrusted input,
 * and the labels this repository actually has.
 */
export async function readWorkItemIssue(
  probation: ProbationRow,
  workItemId: string,
) {
  const item = await loadItem(probation.id, workItemId);
  return {
    id: item.id,
    context: issueContextSchema.parse(item.context),
    labelCatalog: parseStringList(probation.workLabelCatalog),
    untrustedIssueTitle: item.title,
    untrustedIssueBody: item.body,
  };
}

export interface ProposalInput {
  workItemId: string;
  disposition: Disposition;
  labels: string[];
  confidence: number;
  rationale: string;
}

export async function proposeTriage(
  probation: ProbationRow,
  input: ProposalInput,
) {
  const { workItemId, disposition, labels, confidence, rationale } = input;
  const { known, unknown } = matchLabels(
    labels,
    parseStringList(probation.workLabelCatalog),
  );
  if (unknown.length > 0) {
    fail(
      `This repository has no label named: ${unknown.join(", ")}. Use labelCatalog from read-work-issue.`,
      { errorCode: "unknown_label", statusCode: 422 },
    );
  }
  const updated = await getDb()
    .update(workItems)
    .set({
      status: workMachine.transition("new", "propose"),
      proposedDisposition: disposition,
      proposedLabels: JSON.stringify(known),
      proposedConfidence: confidence,
      proposedRationale: rationale,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(workItems.id, workItemId),
        eq(workItems.probationId, probation.id),
        inArray(workItems.status, [...workMachine.fromStates("propose")]),
      ),
    )
    .returning();
  const item = updated[0];
  if (!item) {
    fail("This work item can no longer take a proposal.", {
      errorCode: "not_proposable",
      statusCode: 409,
    });
  }
  return viewOf(item);
}

export interface ProposedWork {
  item: WorkItemRow;
  disposition: Disposition;
  labels: string[];
  level: TrustLevel;
}

export async function loadProposedWork(
  probationId: string,
  workItemId: string,
): Promise<ProposedWork> {
  const item = await loadItem(probationId, workItemId);
  if (
    !workMachine
      .fromStates("execute")
      .includes(workMachine.parseState(item.status))
  ) {
    fail("This work item has no proposal waiting to be carried out.", {
      errorCode: "not_executable",
      statusCode: 409,
    });
  }
  const disposition = dispositionSchema.parse(item.proposedDisposition);
  const labels = parseStringList(item.proposedLabels);
  return {
    item,
    disposition,
    labels,
    level: await levelOfProposal(
      probationId,
      item.context,
      disposition,
      labels,
    ),
  };
}

/** Evidence weight of one ordinary case in a cell, floored at a single case. */
function meanWeight(cell: Awaited<ReturnType<typeof loadCell>>): number {
  const { cases, weightedTotal } = cell.aggregate;
  return cases > 0 ? Math.max(1, weightedTotal / cases) : 1;
}

async function recordLiveVerdict(
  probation: ProbationRow,
  item: WorkItemRow,
  verdict: {
    source: "review" | "overrule";
    truth: Disposition;
    weightMultiplier: number;
  },
): Promise<void> {
  const answer = dispositionSchema.parse(item.proposedDisposition);
  const cell = await loadCell(probation, {
    action: answer,
    context: issueContextSchema.parse(item.context),
  });
  const now = new Date().toISOString();
  await getDb()
    .insert(examCases)
    .values({
      id: randomUUID(),
      probationId: probation.id,
      source: verdict.source,
      issueNumber: item.issueNumber,
      issueUrl: item.issueUrl,
      title: item.title,
      body: item.body,
      context: item.context,
      weight: meanWeight(cell) * verdict.weightMultiplier,
      truthDisposition: verdict.truth,
      answerDisposition: answer,
      answerLabels: item.proposedLabels ?? "[]",
      answerConfidence: item.proposedConfidence,
      answerRationale: item.proposedRationale,
      dispositionCorrect: answer === verdict.truth,
      answeredAt: now,
      createdAt: now,
    })
    .onConflictDoNothing();
}

/**
 * Carries out a proposal. Autonomy was already decided by the action's approval
 * gate; `actor` only records who ended up responsible for this call.
 */
export async function executeTriage(
  probation: ProbationRow,
  github: GitHubClient,
  work: ProposedWork,
  actor: Actor,
) {
  const repo = requireWorkRepo(probation);
  const { item, disposition, labels, level } = work;
  const appliedLabels =
    disposition === "accept" ? [...labels, probation.triagedLabel] : labels;

  await github.addLabels(repo, item.issueNumber, appliedLabels);
  if (isClosing(disposition)) {
    await github.closeIssue(repo, item.issueNumber, disposition);
  }

  const updated = await getDb()
    .update(workItems)
    .set({
      status: workMachine.transition("proposed", "execute"),
      executedAtLevel: level,
      executedBy: actor,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(workItems.id, item.id),
        inArray(workItems.status, [...workMachine.fromStates("execute")]),
      ),
    )
    .returning();
  const executed = updated[0];
  if (!executed) {
    fail("Someone else already decided this work item.", {
      errorCode: "already_decided",
      statusCode: 409,
    });
  }
  // A person standing behind the call is new evidence; unsupervised work is not.
  if (level !== "solo") {
    await recordLiveVerdict(probation, item, {
      source: "review",
      truth: disposition,
      weightMultiplier: 1,
    });
  }
  return viewOf(executed);
}

export interface OverruleInput {
  workItemId: string;
  correctDisposition: Disposition;
  note: string;
}

/**
 * The correction the whole product hangs on: the cell loses a level at once,
 * the case joins the exam with extra weight, and a wrong close gets undone.
 */
export async function overruleTriage(
  probation: ProbationRow,
  writer: () => Promise<GitHubClient>,
  input: OverruleInput,
) {
  const { workItemId, correctDisposition, note } = input;
  const item = await loadItem(probation.id, workItemId);
  const status = workMachine.parseState(item.status);
  if (!workMachine.can(status, "overrule")) {
    fail("There is no proposal here to overrule.", {
      errorCode: "not_overrulable",
      statusCode: 409,
    });
  }
  const proposed = dispositionSchema.parse(item.proposedDisposition);
  if (proposed === correctDisposition) {
    fail("That is what the agent proposed. Choose a different outcome.", {
      errorCode: "same_disposition",
      statusCode: 422,
    });
  }

  if (status === "executed" && isClosing(proposed)) {
    const github = await writer();
    await github.reopenIssue(requireWorkRepo(probation), item.issueNumber);
  }

  const updated = await getDb()
    .update(workItems)
    .set({
      status: workMachine.transition(status, "overrule"),
      overruleNote: note,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(workItems.id, item.id),
        inArray(workItems.status, [...workMachine.fromStates("overrule")]),
      ),
    )
    .returning();
  const overruled = updated[0];
  if (!overruled) {
    fail("This work item was already overruled.", {
      errorCode: "already_decided",
      statusCode: 409,
    });
  }

  await getDb()
    .delete(examCases)
    .where(
      and(
        eq(examCases.probationId, probation.id),
        eq(examCases.source, "review"),
        eq(examCases.issueNumber, item.issueNumber),
      ),
    );
  await recordLiveVerdict(probation, item, {
    source: "overrule",
    truth: correctDisposition,
    weightMultiplier: policyOf(probation).overrulePenalty,
  });
  const key = {
    action: proposed,
    context: issueContextSchema.parse(item.context),
  };
  const newLevel = await demoteCell(
    probation.id,
    key,
    `Overruled on issue #${item.issueNumber}: ${note}`,
  );
  return { item: await viewOf(overruled), newLevel };
}
