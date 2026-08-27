import { countGettingStartedTasks, isGettingStartedTaskComplete } from "../shared/gettingStarted";
import { describe, expect, it } from "vitest";

describe("jalons de prise en main", () => {
  it("distingue les jalons réellement atteints des étapes encore à découvrir", () => {
    const milestones = { hasClient: true, hasQuote: false, hasReviewedReceivables: true };
    expect(isGettingStartedTaskComplete("client", milestones)).toBe(true);
    expect(isGettingStartedTaskComplete("quote", milestones)).toBe(false);
    expect(countGettingStartedTasks(milestones)).toBe(2);
  });
});
