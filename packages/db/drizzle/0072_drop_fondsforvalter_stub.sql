--
-- Fjern `fondsforvalter`-stubben fra Lepton-importen.
--
-- The row is a leftover: name "Fondsforvalter", no description, no contact,
-- created on the import date, and carrying `type = 'STUDY'` although it is not
-- a study programme. That type is not cosmetic — it made the group look like a
-- study everywhere studies are read, and `lib/user/study.ts` carries explicit
-- ranking code so it can never win over a real one on a member's profile. The
-- guard stays; this removes the thing it was written for.
--
-- The position it named is real, but it is held elsewhere: the fondsforvalter
-- is the leader of Forvaltningsgruppen, which is what De Eldstes Raad reads.
--
-- Deleting a group cascades over ten foreign keys, so the delete is guarded on
-- every one of them that carries data. Should anything have been attached in
-- the meantime — a fine, a law, a verv, a form, an event, a priority pool, an
-- application — the DELETE matches nothing and the group stays. Then a human
-- decides, rather than a migration quietly taking a fine or a priority pool
-- with it.
--
-- The one thing that does go is the group's own roster: a single membership in
-- production, which grants nothing (member_permissions is empty) and is what
-- removing a group means. It is deleted explicitly rather than left to the
-- cascade, so the count in the migration matches what is actually removed.
--
DELETE FROM "org_group_membership"
WHERE "group_slug" = 'fondsforvalter'
  AND NOT EXISTS (SELECT 1 FROM "org_fine" WHERE "group_slug" = 'fondsforvalter')
  AND NOT EXISTS (SELECT 1 FROM "org_group_law" WHERE "group_slug" = 'fondsforvalter')
  AND NOT EXISTS (SELECT 1 FROM "org_group_position" WHERE "group_slug" = 'fondsforvalter' OR "linked_group_slug" = 'fondsforvalter')
  AND NOT EXISTS (SELECT 1 FROM "form_group_form" WHERE "group_slug" = 'fondsforvalter')
  AND NOT EXISTS (SELECT 1 FROM "event_event" WHERE "organizer_group_slug" = 'fondsforvalter')
  AND NOT EXISTS (SELECT 1 FROM "event_priority_pool_group" WHERE "group_slug" = 'fondsforvalter')
  AND NOT EXISTS (SELECT 1 FROM "event_priority_pool" WHERE "group_slug" = 'fondsforvalter')
  AND NOT EXISTS (SELECT 1 FROM "application_expense" WHERE "group_slug" = 'fondsforvalter')
  AND NOT EXISTS (SELECT 1 FROM "application_support" WHERE "group_slug" = 'fondsforvalter')
  AND NOT EXISTS (SELECT 1 FROM "org_group_membership_history" WHERE "group_slug" = 'fondsforvalter');--> statement-breakpoint

DELETE FROM "org_group"
WHERE "slug" = 'fondsforvalter'
  AND NOT EXISTS (SELECT 1 FROM "org_group_membership" WHERE "group_slug" = 'fondsforvalter')
  AND NOT EXISTS (SELECT 1 FROM "org_fine" WHERE "group_slug" = 'fondsforvalter')
  AND NOT EXISTS (SELECT 1 FROM "org_group_law" WHERE "group_slug" = 'fondsforvalter')
  AND NOT EXISTS (SELECT 1 FROM "org_group_position" WHERE "group_slug" = 'fondsforvalter' OR "linked_group_slug" = 'fondsforvalter')
  AND NOT EXISTS (SELECT 1 FROM "form_group_form" WHERE "group_slug" = 'fondsforvalter')
  AND NOT EXISTS (SELECT 1 FROM "event_event" WHERE "organizer_group_slug" = 'fondsforvalter')
  AND NOT EXISTS (SELECT 1 FROM "event_priority_pool_group" WHERE "group_slug" = 'fondsforvalter')
  AND NOT EXISTS (SELECT 1 FROM "event_priority_pool" WHERE "group_slug" = 'fondsforvalter')
  AND NOT EXISTS (SELECT 1 FROM "application_expense" WHERE "group_slug" = 'fondsforvalter')
  AND NOT EXISTS (SELECT 1 FROM "application_support" WHERE "group_slug" = 'fondsforvalter')
  AND NOT EXISTS (SELECT 1 FROM "org_group_membership_history" WHERE "group_slug" = 'fondsforvalter');
