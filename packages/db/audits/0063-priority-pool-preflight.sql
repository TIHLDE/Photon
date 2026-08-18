-- Pre-flight audit for migration 0063. Not run by drizzle — run it by hand
-- against production before applying, and paste the counts into the PR.
--
-- `does_not_fit` counts pools the new one-group-one-class shape cannot hold.
-- The second query restricts to events that have not happened yet, which is
-- the only subset where a narrowed pool changes a real registration outcome.
-- Expect 0 there; if not, convert those pools by hand before deploying.
SELECT count(*) FILTER (WHERE n_year = 0 AND n_other = 1) AS group_only,
       count(*) FILTER (WHERE n_year = 1 AND n_other = 0) AS class_only,
       count(*) FILTER (WHERE n_year = 1 AND n_other = 1) AS group_and_class,
       count(*) FILTER (WHERE n_other > 1 OR n_year > 1)  AS does_not_fit,
       count(*) FILTER (WHERE n_year + n_other = 0)       AS empty
FROM (
  SELECT p.id,
    count(*) FILTER (WHERE upper(g.type) = 'STUDYYEAR')  AS n_year,
    count(*) FILTER (WHERE upper(g.type) <> 'STUDYYEAR') AS n_other
  FROM event_priority_pool p
  LEFT JOIN event_priority_pool_group pg ON pg.priority_pool_id = p.id
  LEFT JOIN org_group g ON g.slug = pg.group_slug
  GROUP BY p.id
) s;

-- Same, restricted to events that have not started yet.
SELECT count(*) FILTER (WHERE n_other > 1 OR n_year > 1) AS does_not_fit_future
FROM (
  SELECT p.id,
    count(*) FILTER (WHERE upper(g.type) = 'STUDYYEAR')  AS n_year,
    count(*) FILTER (WHERE upper(g.type) <> 'STUDYYEAR') AS n_other
  FROM event_priority_pool p
  JOIN event_event e ON e.id = p.event_id
  LEFT JOIN event_priority_pool_group pg ON pg.priority_pool_id = p.id
  LEFT JOIN org_group g ON g.slug = pg.group_slug
  WHERE e.start > now()
  GROUP BY p.id
) s;
