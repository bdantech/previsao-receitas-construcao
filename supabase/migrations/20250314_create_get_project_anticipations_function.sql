-- Create a function to get anticipations for a project
CREATE OR REPLACE FUNCTION public.get_project_anticipations(p_company_id uuid, p_project_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
BEGIN
  WITH anticipations AS (
    SELECT 
      ar.id,
      ar.project_id,
      ar.valor_total,
      ar.valor_liquido,
      ar.status,
      ar.quantidade_recebiveis,
      ar.created_at,
      ar.updated_at,
      p.name as project_name
    FROM 
      public.anticipation_requests ar
      JOIN public.projects p ON ar.project_id = p.id
    WHERE 
      ar.company_id = p_company_id
      AND (p_project_id IS NULL OR ar.project_id = p_project_id)
    ORDER BY 
      ar.created_at DESC
  )
  SELECT json_agg(anticipations) INTO v_result FROM anticipations;
  
  -- Return empty array if no results
  IF v_result IS NULL THEN
    RETURN '[]'::json;
  END IF;
  
  RETURN v_result;
END;
$$; 