-- One-time tidy of capitals in text people typed (same rules as src/lib/text.ts for new entries).
-- Only text typed entirely in CAPITALS or entirely in small letters is changed; text with mixed
-- capitals ("GGU Store", "McDonald") was typed on purpose and is left alone. Text with digits is left
-- alone for names (codes like "Shop 2B").

-- Title Case: "KULDEEP YOGENDRA SINGH" -> "Kuldeep Yogendra Singh", "STATE BANK OF INDIA" -> "State Bank of India".
CREATE OR REPLACE FUNCTION pg_temp.hrms_title(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN t IS NULL OR t !~ '[[:alpha:]]' OR t ~ '[0-9]' OR (t <> upper(t) AND t <> lower(t)) THEN t
    ELSE
      replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
        ' ' || initcap(regexp_replace(btrim(t), '\s+', ' ', 'g')) || ' ',
        ' Of ', ' of '), ' And ', ' and '), ' The ', ' the '), ' For ', ' for '), ' In ', ' in '), ' On ', ' on '),
        ' At ', ' at '), ' To ', ' to '), ' By ', ' by '), ' A ', ' a '), ' An ', ' an '), ' Or ', ' or ')
  END
$$;
-- The first word always keeps its capital ("The Shop"); trim the padding spaces.
CREATE OR REPLACE FUNCTION pg_temp.hrms_name(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN pg_temp.hrms_title(t) IS DISTINCT FROM t
    THEN upper(left(btrim(pg_temp.hrms_title(t)), 1)) || substr(btrim(pg_temp.hrms_title(t)), 2)
    ELSE t END
$$;
-- Sentence case for notes and reasons: "SALARY TILL DIWALI" -> "Salary till diwali".
CREATE OR REPLACE FUNCTION pg_temp.hrms_note(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN t IS NULL OR t !~ '^\s*[[:alpha:]]' OR (t <> upper(t) AND t <> lower(t)) THEN t
    ELSE upper(left(lower(btrim(t)), 1)) || substr(lower(btrim(t)), 2)
  END
$$;

-- People
UPDATE "Employee" SET "name" = pg_temp.hrms_name("name") WHERE pg_temp.hrms_name("name") IS DISTINCT FROM "name";
UPDATE "Employee" SET "bankAccountName" = pg_temp.hrms_name("bankAccountName") WHERE pg_temp.hrms_name("bankAccountName") IS DISTINCT FROM "bankAccountName";
UPDATE "Employee" SET "bankName" = pg_temp.hrms_name("bankName") WHERE pg_temp.hrms_name("bankName") IS DISTINCT FROM "bankName";
UPDATE "Employee" SET "bankBranch" = pg_temp.hrms_name("bankBranch") WHERE pg_temp.hrms_name("bankBranch") IS DISTINCT FROM "bankBranch";
UPDATE "User" SET "name" = pg_temp.hrms_name("name") WHERE pg_temp.hrms_name("name") IS DISTINCT FROM "name";

-- Places and labels
UPDATE "Business" SET "name" = pg_temp.hrms_name("name") WHERE pg_temp.hrms_name("name") IS DISTINCT FROM "name";
UPDATE "Holiday" SET "name" = pg_temp.hrms_name("name") WHERE pg_temp.hrms_name("name") IS DISTINCT FROM "name";
UPDATE "Device" SET "name" = pg_temp.hrms_name("name") WHERE pg_temp.hrms_name("name") IS DISTINCT FROM "name";
-- Site and shift names are unique per business: skip a row if the tidied name is already taken
-- (or two rows would become the same name; the first one by id is changed).
UPDATE "Site" s SET "name" = pg_temp.hrms_name(s."name")
WHERE pg_temp.hrms_name(s."name") IS DISTINCT FROM s."name"
  AND NOT EXISTS (SELECT 1 FROM "Site" o WHERE o."businessId" = s."businessId" AND o."id" <> s."id"
                  AND (o."name" = pg_temp.hrms_name(s."name") OR (pg_temp.hrms_name(o."name") = pg_temp.hrms_name(s."name") AND o."id" < s."id")));
UPDATE "Shift" s SET "name" = pg_temp.hrms_name(s."name")
WHERE pg_temp.hrms_name(s."name") IS DISTINCT FROM s."name"
  AND NOT EXISTS (SELECT 1 FROM "Shift" o WHERE o."businessId" = s."businessId" AND o."id" <> s."id"
                  AND (o."name" = pg_temp.hrms_name(s."name") OR (pg_temp.hrms_name(o."name") = pg_temp.hrms_name(s."name") AND o."id" < s."id")));

-- Notes and reasons
UPDATE "Advance" SET "note" = pg_temp.hrms_note("note") WHERE pg_temp.hrms_note("note") IS DISTINCT FROM "note";
UPDATE "SalaryPayment" SET "note" = pg_temp.hrms_note("note") WHERE pg_temp.hrms_note("note") IS DISTINCT FROM "note";
UPDATE "Adjustment" SET "reason" = pg_temp.hrms_note("reason") WHERE pg_temp.hrms_note("reason") IS DISTINCT FROM "reason";
UPDATE "AttendancePunch" SET "reason" = pg_temp.hrms_note("reason") WHERE pg_temp.hrms_note("reason") IS DISTINCT FROM "reason";
UPDATE "AttendancePunch" SET "voidReason" = pg_temp.hrms_note("voidReason") WHERE pg_temp.hrms_note("voidReason") IS DISTINCT FROM "voidReason";
UPDATE "DayOverride" SET "reason" = pg_temp.hrms_note("reason") WHERE pg_temp.hrms_note("reason") IS DISTINCT FROM "reason";
UPDATE "LeavePlan" SET "reason" = pg_temp.hrms_note("reason") WHERE pg_temp.hrms_note("reason") IS DISTINCT FROM "reason";
