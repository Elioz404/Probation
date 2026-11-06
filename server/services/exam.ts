import { randomUUID } from "node:crypto";

import { fail } from "@agent-native/core/action";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
} from "drizzle-orm";

import { classifyIssueContext } from "../../shared/trust/context.js";
import { gradeAnswer } from "../../shared/trust/grading.js";
import {
  DISPOSITIONS,
  dispositionSchema,
  issueContextSchema,
  type Disposition,
} from "../../shared/trust/model.js";
import { getDb, schema } from "../db/index.js";
import type { GitHubClient, GitHubIssue } from "../github/client.js";
import {
  parseStringList,
  recordExamImport,
  type ProbationRow,
} from "./probations.js";

const { examCases } = schema;

/** Keeps one enormous issue from dominating a question or the database. */
export const MAX_ISSUE_BODY_CHARS = 6000;

export const HISTORY_SOURCE = "history";

export function clipIssueBody(body: string): string {
  return body.slice(0, MAX_ISSUE_BODY_CHARS);
}

function historyCase(
  probationId: string,
  issue: GitHubIssue,
  disposition: Disposition,
  weight: number,
  createdAt: string,
) {
  const body = clipIssueBody(issue.body);
  return {
    id: randomUUID(),
    probationId,
    source: HISTORY_SOURCE,
    issueNumber: issue.number,
    issueUrl: issue.url,
    title: issue.title,
    body,
    context: classifyIssueContext({
      authorAssociation: issue.authorAssociation,
      body,
    }),
    weight,
    truthDisposition: disposition,
    truthLabels: JSON.stringify(issue.labels),
    createdAt,
  };
}

/**
 * Samples each maintainer outcome evenly so rare ones can be examined at all,
 * then weights every case so aggregates still reflect the repository's real mix.
 */
export async function importExam(
  probation: ProbationRow,
  github: GitHubClient,
  questionsPerOutcome: number,
) {
  const [labels, ...samples] = await Promise.all([
    github.listLabels(probation.examRepo),
    ...DISPOSITIONS.map((outcome) =>
      github.sampleClosedIssues(
        probation.examRepo,
        outcome,
        questionsPerOutcome,
      ),
    ),
  ]);

  const populations = Object.fromEntries(
    DISPOSITIONS.map((outcome, i) => [outcome, samples[i]!.total]),
  ) as Record<Disposition, number>;

  const now = new Date().toISOString();
  const rows = DISPOSITIONS.flatMap((outcome, i) => {
    const { total, issues } = samples[i]!;
    const humanIssues = issues.filter((issue) => !issue.authorIsBot);
    const weight = humanIssues.length > 0 ? total / humanIssues.length : 0;
    return humanIssues.map((issue) =>
      historyCase(probation.id, issue, outcome, weight, now),
    );
  });

  if (rows.length === 0) {
    fail("This repository has no closed issues to build an exam from.", {
      errorCode: "no_history",
      statusCode: 422,
    });
  }

  const inserted = await getDb()
    .insert(examCases)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: examCases.id });
  await recordExamImport(probation.id, populations, labels);
  return { imported: inserted.length, populations };
}

async function examCounts(probationId: string) {
  const [row] = await getDb()
    .select({ total: count(), answered: count(examCases.answeredAt) })
    .from(examCases)
    .where(
      and(
        eq(examCases.probationId, probationId),
        eq(examCases.source, HISTORY_SOURCE),
      ),
    );
  return {
    answered: row?.answered ?? 0,
    remaining: (row?.total ?? 0) - (row?.answered ?? 0),
  };
}

/**
 * Hands out only what existed when each issue opened. Issue text is attacker
 * controlled, hence the `untrusted` field names. Random ids order the questions,
 * so outcomes arrive shuffled rather than grouped by stratum.
 */
export async function getExamQuestions(probation: ProbationRow, limit: number) {
  const rows = await getDb()
    .select({
      caseId: examCases.id,
      context: examCases.context,
      title: examCases.title,
      body: examCases.body,
    })
    .from(examCases)
    .where(
      and(
        eq(examCases.probationId, probation.id),
        eq(examCases.source, HISTORY_SOURCE),
        isNull(examCases.answeredAt),
      ),
    )
    .orderBy(asc(examCases.id))
    .limit(limit);
  return {
    ...(await examCounts(probation.id)),
    labelCatalog: parseStringList(probation.labelCatalog),
    questions: rows.map((row) => ({
      caseId: row.caseId,
      context: issueContextSchema.parse(row.context),
      untrustedIssueTitle: row.title,
      untrustedIssueBody: row.body,
    })),
  };
}

export interface ExamAnswerInput {
  caseId: string;
  disposition: Disposition;
  labels: string[];
  confidence: number;
  rationale: string;
}

/**
 * Grades in code, once per case. The response reports progress only: telling
 * the examinee how it did mid-exam would let it learn the answers as it goes.
 */
export async function submitExamAnswers(
  probation: ProbationRow,
  answers: readonly ExamAnswerInput[],
) {
  const db = getDb();
  const open = await db
    .select({
      id: examCases.id,
      truthDisposition: examCases.truthDisposition,
      truthLabels: examCases.truthLabels,
    })
    .from(examCases)
    .where(
      and(
        eq(examCases.probationId, probation.id),
        eq(examCases.source, HISTORY_SOURCE),
        isNull(examCases.answeredAt),
        inArray(
          examCases.id,
          answers.map((answer) => answer.caseId),
        ),
      ),
    );
  const truthById = new Map(open.map((row) => [row.id, row]));

  let accepted = 0;
  for (const answer of answers) {
    const truth = truthById.get(answer.caseId);
    if (!truth) continue;
    const grade = gradeAnswer(answer, {
      disposition: dispositionSchema.parse(truth.truthDisposition),
      labels: parseStringList(truth.truthLabels),
    });
    const updated = await db
      .update(examCases)
      .set({
        answerDisposition: answer.disposition,
        answerLabels: JSON.stringify(answer.labels),
        answerConfidence: answer.confidence,
        answerRationale: answer.rationale,
        dispositionCorrect: grade.dispositionCorrect,
        labelsCorrect: grade.labelsCorrect,
        answeredAt: new Date().toISOString(),
      })
      .where(and(eq(examCases.id, answer.caseId), isNull(examCases.answeredAt)))
      .returning({ id: examCases.id });
    accepted += updated.length;
  }
  return { accepted, ...(await examCounts(probation.id)) };
}

/** Answer keys stay closed to agents until no question is left to answer. */
export async function getExamResults(
  probation: ProbationRow,
  { callerIsHuman, limit }: { callerIsHuman: boolean; limit: number },
) {
  const { remaining } = await examCounts(probation.id);
  if (!callerIsHuman && remaining > 0) {
    fail(
      `The exam is still running with ${remaining} questions left. Results open when it ends.`,
      { errorCode: "exam_in_progress", statusCode: 409 },
    );
  }
  const rows = await getDb()
    .select()
    .from(examCases)
    .where(
      and(
        eq(examCases.probationId, probation.id),
        isNotNull(examCases.answeredAt),
      ),
    )
    .orderBy(desc(examCases.answeredAt))
    .limit(limit);
  return rows.map((row) => ({
    caseId: row.id,
    source: row.source,
    issueNumber: row.issueNumber,
    issueUrl: row.issueUrl,
    title: row.title,
    context: issueContextSchema.parse(row.context),
    answerDisposition: dispositionSchema.parse(row.answerDisposition),
    answerLabels: parseStringList(row.answerLabels),
    answerRationale: row.answerRationale ?? "",
    truthDisposition: dispositionSchema.parse(row.truthDisposition),
    truthLabels: parseStringList(row.truthLabels),
    dispositionCorrect: row.dispositionCorrect ?? false,
    labelsCorrect: row.labelsCorrect,
    contested: row.contested,
  }));
}

export async function setCaseContested(
  probation: ProbationRow,
  caseId: string,
  contested: boolean,
): Promise<void> {
  const updated = await getDb()
    .update(examCases)
    .set({ contested })
    .where(
      and(eq(examCases.id, caseId), eq(examCases.probationId, probation.id)),
    )
    .returning({ id: examCases.id });
  if (updated.length === 0) {
    fail("Exam case not found.", { errorCode: "not_found", statusCode: 404 });
  }
}
