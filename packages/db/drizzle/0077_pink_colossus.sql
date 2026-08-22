-- Et verv kan holdes av flere samtidig (issue #646). Primærnøkkelen var
-- position_id alene, som er nettopp regelen «én holder» skrevet inn i
-- skjemaet. Den byttes ut med paret (position_id, user_id).
--
-- Constraint-navnet slås opp i katalogen i stedet for å skrives inn: den gamle
-- nøkkelen ble laget inline av Postgres og heter etter alt å dømme
-- «org_group_position_holder_pkey», men det er ikke garantert på tvers av
-- miljøene, og en feil gjetning ville stoppet migreringen.
DO $$
DECLARE
    pk_name text;
BEGIN
    SELECT constraint_name INTO pk_name
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'org_group_position_holder'
      AND constraint_type = 'PRIMARY KEY';

    IF pk_name IS NOT NULL THEN
        EXECUTE format(
            'ALTER TABLE "org_group_position_holder" DROP CONSTRAINT %I',
            pk_name
        );
    END IF;
END $$;--> statement-breakpoint
ALTER TABLE "org_group_position_holder" ADD CONSTRAINT "org_group_position_holder_position_id_user_id_pk" PRIMARY KEY("position_id","user_id");
