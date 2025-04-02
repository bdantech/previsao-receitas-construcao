-- Drop the existing function
DROP FUNCTION IF EXISTS public.update_company_documents_status(uuid, text);

-- Create the function with SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.update_company_documents_status(p_company_id uuid, p_status text)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER -- Alterado de DEFINER para INVOKER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  -- Update the company status
  UPDATE public.companies
  SET documents_status = p_status
  WHERE id = p_company_id
  RETURNING json_build_object(
    'id', id,
    'name', name,
    'documents_status', documents_status
  ) INTO v_result;
  
  -- Return the result
  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_company_documents_status(uuid, text) TO authenticated;

-- Revoke all permissions from public
REVOKE ALL ON FUNCTION public.update_company_documents_status(uuid, text) FROM public;