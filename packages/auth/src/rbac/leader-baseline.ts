/**
 * What EVERY group leader holds for their own group, regardless of what is
 * stored in `group.leaderPermissions`.
 *
 * Running a group means running its arrangementer: putting them up, fixing
 * them, taking them down, and handling who shows up. That is the job, not a
 * privilege someone has to be granted per group — so it lives here rather
 * than in a column that starts empty and has to be filled in 60 times (and
 * once more for every new group).
 *
 * Payments are view-only on purpose: a leader running a paid arrangement has
 * to see who has paid, but moving money back out is a separate decision and
 * stays with whoever holds `events:payments:refund`.
 *
 * Deliberately NOT included, because they are not "arranging an event":
 * refunding payments, handing out prikker by hand, and publishing news. Those
 * still come from `leaderPermissions`, a verv, or a role.
 *
 * `events:manage` is left out for the same reason, even though it reads like
 * the natural fit: the strike routes accept it as an alternative to
 * `events:strikes:*`, so granting it here would hand every leader the power
 * to hand out prikker. Every other route that takes `events:manage` takes
 * `events:update` too, which is in the list, so nothing is lost.
 *
 * This module deliberately imports nothing: the frontend reads the same list
 * to work out what a leader may do (`@photon/auth/rbac/leader-baseline`), and
 * pulling in the database layer for a string array would drag the server into
 * the browser bundle.
 */
export const LEADER_BASELINE_PERMISSIONS = [
    "events:view",
    "events:create",
    "events:update",
    "events:delete",
    "events:registrations:view",
    "events:registrations:create",
    "events:registrations:delete",
    // Registering oppmøte on the group's own arrangementer
    "events:registrations:checkin",
    "events:registrations:manage",
    "events:feedback:view",
    // Seeing who has paid — never events:payments:refund
    "events:payments:view",
] as const;
