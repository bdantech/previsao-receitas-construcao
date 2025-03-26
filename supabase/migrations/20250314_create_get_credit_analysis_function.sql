-- Create a function to get active credit analysis for a company
CREATE OR REPLACE FUNCTION public.get_active_credit_analysis_for_company(p_company_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT 
    json_build_object(
      'interest_rate_180', cca.interest_rate_180,
      'interest_rate_360', cca.interest_rate_360,
      'interest_rate_720', cca.interest_rate_720,
      'interest_rate_long_term', cca.interest_rate_long_term,
      'fee_per_receivable', cca.fee_per_receivable
    ) INTO v_result
  FROM 
    public.company_credit_analysis cca
  WHERE 
    cca.company_id = p_company_id 
    AND cca.status = 'Ativa'
  LIMIT 1;
  
  RETURN v_result;
END;
$$;

-- Update the calculate_anticipation_valor_liquido function with new formula
CREATE OR REPLACE FUNCTION public.calculate_anticipation_valor_liquido(p_receivable_ids uuid[], p_company_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_valor_total NUMERIC := 0;
  v_valor_liquido NUMERIC := 0;
  v_fee_deduction NUMERIC := 0;
  v_quantidade_recebiveis INTEGER := 0;
  v_tarifa_por_recebivel NUMERIC;
  v_rec RECORD;
  v_interest_rate NUMERIC;
  v_days_to_due INTEGER;
BEGIN
  -- Get the fee per receivable from company credit analysis
  SELECT fee_per_receivable INTO v_tarifa_por_recebivel
  FROM company_credit_analysis
  WHERE company_credit_analysis.company_id = p_company_id AND status = 'Ativa'
  LIMIT 1;
  
  IF v_tarifa_por_recebivel IS NULL THEN
    RAISE EXCEPTION 'No active credit analysis found for company';
  END IF;
  
  -- Process each receivable
  v_quantidade_recebiveis := array_length(p_receivable_ids, 1);
  IF v_quantidade_recebiveis IS NULL OR v_quantidade_recebiveis = 0 THEN
    RAISE EXCEPTION 'At least one receivable is required';
  END IF;
  
  -- Calculate fee deduction
  v_fee_deduction := v_quantidade_recebiveis * v_tarifa_por_recebivel;
  
  -- Calculate valor liquido for each receivable
  FOR v_rec IN 
    SELECT r.id, r.amount, r.due_date
    FROM receivables r
    WHERE r.id = ANY(p_receivable_ids)
  LOOP
    v_valor_total := v_valor_total + v_rec.amount;
    
    -- Calculate days between today and due date
    v_days_to_due := (v_rec.due_date - CURRENT_DATE);
    
    -- Get appropriate interest rate based on days to due
    v_interest_rate := public.get_company_interest_rate(p_company_id, v_days_to_due);
    
    -- Calculate valor liquido for this receivable using the new formula
    -- Note: We divide interest rate by 100 since it's stored as percentage
    v_valor_liquido := v_valor_liquido + (
      v_rec.amount - (
        (v_rec.amount * POWER((v_interest_rate/100 + 1), v_days_to_due::numeric/30)) - v_rec.amount
      ) - v_tarifa_por_recebivel
    );
  END LOOP;
  
  RETURN v_valor_liquido;
END;
$function$; 