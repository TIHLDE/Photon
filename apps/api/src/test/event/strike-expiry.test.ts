import { STRIKE_ACTIVE_DAYS, getStrikeActiveCutoff } from "~/lib/event/strikes";
import { assert, describe, expect, test } from "vitest";

const DAY_MS = 24 * 60 * 60 * 1000;

/** A strike created at `createdAt` is active at `now` iff createdAt >= cutoff. */
function isActive(createdAt: Date, now: Date): boolean {
    return createdAt.getTime() >= getStrikeActiveCutoff(now).getTime();
}

describe("strike expiry cutoff", () => {
    test("strike is active within the 20-day window (no freeze)", () => {
        // Mid-October: no freeze period nearby.
        const now = new Date(Date.UTC(2025, 9, 20));
        const justCreated = new Date(now.getTime() - 1 * DAY_MS);
        const day19 = new Date(now.getTime() - 19 * DAY_MS);
        assert.isTrue(isActive(justCreated, now));
        assert.isTrue(isActive(day19, now));
    });

    test("strike expires after 20 days (no freeze)", () => {
        const now = new Date(Date.UTC(2025, 9, 20));
        const day21 = new Date(now.getTime() - 21 * DAY_MS);
        assert.isFalse(isActive(day21, now));
    });

    test("cutoff equals now minus 20 days when no freeze is in the window", () => {
        const now = new Date(Date.UTC(2025, 9, 20));
        expect(getStrikeActiveCutoff(now).getTime()).toBe(
            now.getTime() - STRIKE_ACTIVE_DAYS * DAY_MS,
        );
    });

    test("winter freeze holds a strike active through the period", () => {
        // Strike given 25 Nov 2025 → only 4 non-frozen days pass before the
        // winter freeze starts on 29 Nov. It must remain active during the
        // freeze and until its remaining ~16 days elapse after 9 Jan.
        const createdAt = new Date(Date.UTC(2025, 10, 25));

        // Deep inside the freeze, well past a naive 20-day expiry.
        const duringFreeze = new Date(Date.UTC(2025, 11, 28));
        assert.isTrue(isActive(createdAt, duringFreeze));

        // Right after the freeze ends (10 Jan) the ~16 remaining days still run.
        const justAfterFreeze = new Date(Date.UTC(2026, 0, 12));
        assert.isTrue(isActive(createdAt, justAfterFreeze));

        // Long after the freeze the remaining budget is spent → expired.
        const wellAfterFreeze = new Date(Date.UTC(2026, 1, 15));
        assert.isFalse(isActive(createdAt, wellAfterFreeze));
    });

    test("summer freeze holds a strike active through the period", () => {
        // Strike given 1 May 2025 → 9 non-frozen days before summer freeze
        // (10 May – 15 Aug). Stays active across the whole freeze.
        const createdAt = new Date(Date.UTC(2025, 4, 1));
        const duringFreeze = new Date(Date.UTC(2025, 6, 1));
        assert.isTrue(isActive(createdAt, duringFreeze));
        // 11 non-frozen days remain after 15 Aug; still active a week later.
        const justAfterFreeze = new Date(Date.UTC(2025, 7, 22));
        assert.isTrue(isActive(createdAt, justAfterFreeze));
    });

    test("strike expiring before a freeze begins is not revived by it", () => {
        // Given 1 Nov 2025, it expires ~21 Nov — before the 29 Nov freeze.
        const createdAt = new Date(Date.UTC(2025, 10, 1));
        const duringFreeze = new Date(Date.UTC(2025, 11, 28));
        assert.isFalse(isActive(createdAt, duringFreeze));
    });
});
