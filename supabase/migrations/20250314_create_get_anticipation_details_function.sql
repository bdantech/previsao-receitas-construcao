-- Create a function to get anticipation details
CREATE OR REPLACE FUNCTION public.get_anticipation_details(p_anticipation_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_anticipation json;
  v_receivables json;
BEGIN
  -- Get anticipation details with related project and company info
  SELECT 
    json_build_object(
      'id', ar.id,
      'company_id', ar.company_id,
      'project_id', ar.project_id,
      'valor_total', ar.valor_total,
      'valor_liquido', ar.valor_liquido,
      'status', ar.status,
      'quantidade_recebiveis', ar.quantidade_recebiveis,
      'created_at', ar.created_at,
      'updated_at', ar.updated_at,
      'taxa_juros_180', ar.taxa_juros_180,
      'taxa_juros_360', ar.taxa_juros_360,
      'taxa_juros_720', ar.taxa_juros_720,
      'taxa_juros_longo_prazo', ar.taxa_juros_longo_prazo,
      'tarifa_por_recebivel', ar.tarifa_por_recebivel,
      'projects', json_build_object(
        'name', p.name,
        'cnpj', p.cnpj
      ),
      'companies', json_build_object(
        'name', c.name,
        'cnpj', c.cnpj
      )
    ) INTO v_anticipation
  FROM 
    public.anticipation_requests ar
    JOIN public.projects p ON ar.project_id = p.id
    JOIN public.companies c ON ar.company_id = c.id
  WHERE 
    ar.id = p_anticipation_id;
  
  -- Get associated receivables
  WITH receivables_data AS (
    SELECT 
      r.id,
      r.buyer_name,
      r.buyer_cpf,
      r.amount,
      r.due_date,
      r.description,
      r.status
    FROM 
      public.receivables r
      JOIN public.anticipation_receivables ar ON r.id = ar.receivable_id
    WHERE 
      ar.anticipation_id = p_anticipation_id
  )
  SELECT json_agg(receivables_data) INTO v_receivables FROM receivables_data;
  
  -- Return empty array if no receivables
  IF v_receivables IS NULL THEN
    v_receivables := '[]'::json;
  END IF;
  
  -- Return combined result
  RETURN json_build_object(
    'anticipation', v_anticipation,
    'receivables', v_receivables
  );
END;
$$; 