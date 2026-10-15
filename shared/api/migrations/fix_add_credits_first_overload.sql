-- Fix first add_credits overload: table user_credit_transactions has no balance_before, reference_id, reference_type.
-- Use only existing columns; store reference in metadata.
-- Apply: docker exec -i stack1-postgres psql -U ai_user -d ai_services < shared/api/migrations/fix_add_credits_first_overload.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.add_credits(
    p_user_id uuid,
    p_amount numeric,
    p_transaction_type character varying,
    p_reference_id uuid DEFAULT NULL::uuid,
    p_description text DEFAULT NULL::text
)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_current_balance DECIMAL(10,2);
    v_transaction_id UUID;
    v_reference_type TEXT;
BEGIN
    SELECT credits INTO v_current_balance
    FROM users
    WHERE id = p_user_id
    FOR UPDATE;

    v_reference_type := CASE
        WHEN p_transaction_type = 'purchase' THEN 'payment'
        WHEN p_transaction_type = 'refund' THEN 'generation_request'
        WHEN p_transaction_type = 'bonus' THEN 'promotion'
        ELSE 'admin_adjustment'
    END;

    INSERT INTO user_credit_transactions (
        user_id,
        transaction_type,
        amount,
        balance_after,
        description,
        metadata
    ) VALUES (
        p_user_id,
        p_transaction_type,
        p_amount,
        v_current_balance + p_amount,
        p_description,
        jsonb_build_object(
            'reference_id', p_reference_id,
            'reference_type', v_reference_type
        )
    ) RETURNING id INTO v_transaction_id;

    UPDATE users
    SET credits = v_current_balance + p_amount
    WHERE id = p_user_id;

    RETURN v_transaction_id;
END;
$function$;

COMMIT;
