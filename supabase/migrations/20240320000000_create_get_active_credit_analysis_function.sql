-- Function to get the active credit analysis for a company
CREATE OR REPLACE FUNCTION get_active_credit_analysis_for_company(p_company_id UUID)
RETURNS TABLE (
  id UUID,
  company_id UUID,
  interest_rate_180 NUMERIC,
  interest_rate_360 NUMERIC,
  interest_rate_720 NUMERIC,
  interest_rate_long_term NUMERIC,
  fee_per_receivable NUMERIC,
  credit_limit NUMERIC,
  consumed_credit NUMERIC,
  operation_days_limit INTEGER,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cca.id,
    cca.company_id,
    cca.interest_rate_180,
    cca.interest_rate_360,
    cca.interest_rate_720,
    cca.interest_rate_long_term,
    cca.fee_per_receivable,
    cca.credit_limit,
    cca.consumed_credit,
    cca.operation_days_limit,
    cca.status,
    cca.created_at,
    cca.updated_at
  FROM company_credit_analysis cca
  WHERE cca.company_id = p_company_id
  AND cca.status = 'Ativa'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 