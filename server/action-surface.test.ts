import { describe, expect, it } from "vitest";

import contestExamCase from "../actions/contest-exam-case.js";
import decidePromotion from "../actions/decide-promotion.js";
import executeTriage from "../actions/execute-triage.js";
import overruleTriage from "../actions/overrule-triage.js";
import setCellLevel from "../actions/set-cell-level.js";
import updateTrustPolicy from "../actions/update-trust-policy.js";

/**
 * The product's promise rests on these flags: if one of them were dropped, an
 * agent could grant itself autonomy and every other test would still pass.
 */
describe("decisions reserved for a person", () => {
  it.each([
    ["decide-promotion", decidePromotion],
    ["set-cell-level", setCellLevel],
    ["update-trust-policy", updateTrustPolicy],
    ["overrule-triage", overruleTriage],
    ["contest-exam-case", contestExamCase],
  ])("%s can only be called from the signed-in UI", (_name, action) => {
    expect(action.uiOnly).toBe(true);
  });
});

describe("execute-triage", () => {
  it("is gated by a predicate rather than a fixed answer", () => {
    expect(typeof executeTriage.needsApproval).toBe("function");
  });

  it("fails closed when the probation cannot be read", async () => {
    const gate = executeTriage.needsApproval as (args: {
      probationId: string;
      workItemId: string;
    }) => Promise<boolean>;
    await expect(
      gate({ probationId: "unknown", workItemId: "unknown" }),
    ).rejects.toBeDefined();
  });
});
