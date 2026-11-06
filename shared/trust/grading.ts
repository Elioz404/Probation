import type { Disposition } from "./model";

/** How the issue was really closed: outcome and labels as GitHub reports them. */
export interface GroundTruth {
  disposition: Disposition;
  labels: readonly string[];
}

export interface ExamAnswer {
  disposition: Disposition;
  labels: readonly string[];
}

export interface ExamGrade {
  dispositionCorrect: boolean;
  /** Null when there is nothing to grade: no labels proposed, or none in truth. */
  labelsCorrect: boolean | null;
}

/** At least half of the proposed labels must match the labels on the issue. */
const LABEL_MIN_PRECISION = 0.5;

const normalizeLabel = (label: string) => label.trim().toLowerCase();

export function gradeAnswer(answer: ExamAnswer, truth: GroundTruth): ExamGrade {
  const dispositionCorrect = answer.disposition === truth.disposition;
  const proposed = new Set(answer.labels.map(normalizeLabel));
  if (proposed.size === 0 || truth.labels.length === 0) {
    return { dispositionCorrect, labelsCorrect: null };
  }
  const actual = new Set(truth.labels.map(normalizeLabel));
  const matches = [...proposed].filter((label) => actual.has(label)).length;
  return {
    dispositionCorrect,
    labelsCorrect: matches / proposed.size >= LABEL_MIN_PRECISION,
  };
}
