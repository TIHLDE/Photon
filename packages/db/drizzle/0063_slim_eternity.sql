ALTER TABLE "event_priority_pool" ADD COLUMN "group_slug" varchar(128);--> statement-breakpoint
ALTER TABLE "event_priority_pool" ADD COLUMN "class_year" smallint;--> statement-breakpoint
ALTER TABLE "event_priority_pool" ADD CONSTRAINT "event_priority_pool_group_slug_org_group_slug_fk" FOREIGN KEY ("group_slug") REFERENCES "public"."org_group"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "priority_pool_event_id_idx" ON "event_priority_pool" USING btree ("event_id");--> statement-breakpoint
-- Backfill: collapse each pool's group rows into the single group + class
-- level the new shape allows.
--
-- Run the audit in `packages/db/audits/0063-priority-pool-preflight.sql` against production
-- before applying this, and record the counts. Every pool in production came
-- from Lepton, so pools that do not fit (2+ non-cohort groups) are expected
-- only on events that have already happened; if the audit finds one on a
-- future event, convert it by hand first.
--
-- 1) Class level from the cohort group, anchored on the EVENT'S OWN start
--    date rather than on deploy day: "2023-kullet" on an event held in autumn
--    2024 meant 2. klasse then, and that is what the stored value has to
--    reproduce. The academic year turns over in August, hence the month test.
UPDATE "event_priority_pool" p SET "class_year" = s.class_year
FROM (
    SELECT pg.priority_pool_id,
           (EXTRACT(YEAR FROM e.start)::int - g.name::int
            + CASE WHEN EXTRACT(MONTH FROM e.start) >= 8 THEN 1 ELSE 0 END) AS class_year
    FROM "event_priority_pool_group" pg
    JOIN "org_group" g ON g.slug = pg.group_slug
    JOIN "event_priority_pool" pp ON pp.id = pg.priority_pool_id
    JOIN "event_event" e ON e.id = pp.event_id
    WHERE upper(g.type) = 'STUDYYEAR' AND g.name ~ '^[0-9]{4}$'
) s
WHERE p.id = s.priority_pool_id AND s.class_year BETWEEN 1 AND 5;--> statement-breakpoint
-- 2) The single non-cohort group. `min` is deterministic; a pool that named
--    more than one keeps the others in `event_priority_pool_group`, which is
--    retained as an archive precisely so this narrowing is recoverable.
UPDATE "event_priority_pool" p SET "group_slug" = s.slug
FROM (
    SELECT pg.priority_pool_id, min(pg.group_slug) AS slug
    FROM "event_priority_pool_group" pg
    JOIN "org_group" g ON g.slug = pg.group_slug
    WHERE upper(g.type) <> 'STUDYYEAR'
    GROUP BY pg.priority_pool_id
) s
WHERE p.id = s.priority_pool_id;--> statement-breakpoint
-- 3) Pools that ended up expressing nothing, and would violate the CHECK added
--    in the next migration. Two cases, both already inert: a pool with no group
--    rows at all, and a cohort-only pool whose class level fell outside 1-5
--    (an alumni cohort on an old event). `isUserPrioritized` required at least
--    one group slug, and an alumni cohort matched nobody, so deleting them
--    changes no registration outcome.
DELETE FROM "event_priority_pool"
WHERE "group_slug" IS NULL AND "class_year" IS NULL;
