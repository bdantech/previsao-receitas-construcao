-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS public.calculate_index_adjustment(uuid, date, date);

-- Create the function with compound interest calculation
CREATE OR REPLACE FUNCTION public.calculate_index_adjustment(
  p_index_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compound_factor numeric := 1.0;
  v_adjustment record;
BEGIN
  -- Format dates to always use first day of month
  p_start_date := date_trunc('month', p_start_date)::date;
  p_end_date := date_trunc('month', p_end_date)::date;

  -- Fetch all relevant monthly adjustments
  FOR v_adjustment IN 
    SELECT monthly_adjustment
    FROM indexes_update
    WHERE index_id = p_index_id
      AND reference_month >= p_start_date
      AND reference_month <= p_end_date
    ORDER BY reference_month
  LOOP
    -- Convert percentage to decimal factor (e.g., 2.5% -> 1.025)
    v_compound_factor := v_compound_factor * (1 + v_adjustment.monthly_adjustment / 100);
  END LOOP;

  -- Convert compound factor to percentage
  RETURN (v_compound_factor - 1) * 100;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.calculate_index_adjustment(uuid, date, date) TO authenticated;

-- Revoke all permissions from public
REVOKE ALL ON FUNCTION public.calculate_index_adjustment(uuid, date, date) FROM public;

-- Add comment
COMMENT ON FUNCTION public.calculate_index_adjustment(uuid, date, date) IS 'Calculates the compound index adjustment percentage between two dates for a given index.';
