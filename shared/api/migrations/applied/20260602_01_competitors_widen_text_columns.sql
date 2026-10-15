-- Widen legacy competitors VARCHAR(50) columns so AMKA/document autofill can persist LLM text.
-- Idempotent: no-op when types are already wide enough.

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'competitors'
          AND column_name = 'market_position'
          AND character_maximum_length IS NOT NULL
          AND character_maximum_length < 255
    ) THEN
        ALTER TABLE public.competitors
            ALTER COLUMN market_position TYPE VARCHAR(255);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'competitors'
          AND column_name = 'pricing_strategy'
          AND data_type <> 'text'
    ) THEN
        ALTER TABLE public.competitors
            ALTER COLUMN pricing_strategy TYPE TEXT;
    END IF;
END $$;

COMMIT;
