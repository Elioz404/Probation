import { describe, expect, it } from "vitest";

import { requiresApproval } from "./gate";

describe("requiresApproval", () => {
  it.each(["tool", "mcp", "http", "cli"])(
    "always stops %s on Ask",
    (caller) => {
      expect(requiresApproval("ask", caller)).toBe(true);
    },
  );

  it.each(["tool", "mcp", "http", "cli"])(
    "lets %s through on Solo",
    (caller) => {
      expect(requiresApproval("solo", caller)).toBe(false);
    },
  );

  it("makes unproven HTTP, including a spoofed UI header, prove itself on Observe", () => {
    expect(requiresApproval("observe", "http")).toBe(true);
  });

  it.each(["mcp", "tool", "cli"])(
    "leaves %s on Observe to the refusal in the action",
    (caller) => {
      expect(requiresApproval("observe", caller)).toBe(false);
    },
  );
});
