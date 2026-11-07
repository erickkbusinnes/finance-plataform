-- Workspace erasure cascades through accounts, transactions and planning tables.
-- Check cross-table references at transaction commit, after every cascade has run.
-- Ordinary writes remain protected by the same foreign keys and service validation.
DO $$
DECLARE reference_record record;
BEGIN
  FOR reference_record IN
    SELECT n.nspname, r.relname, c.conname
    FROM pg_constraint c
    JOIN pg_class r ON r.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=r.relnamespace
    WHERE c.contype='f' AND c.confdeltype='a' AND n.nspname=current_schema()
      AND r.relname IN ('categories','transactions','transaction_entries','budgets',
        'card_purchases','card_statements','debt_payments','holdings')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ALTER CONSTRAINT %I DEFERRABLE INITIALLY DEFERRED',
      reference_record.nspname,reference_record.relname,reference_record.conname);
  END LOOP;
END $$;
