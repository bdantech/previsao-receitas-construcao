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