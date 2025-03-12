-- Create a function to execute dynamic SQL with parameters
CREATE OR REPLACE FUNCTION public.execute_sql(params jsonb, query_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    EXECUTE query_text
    INTO result
    USING params;
    
    RETURN result;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'error', SQLERRM,
        'detail', SQLSTATE
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.execute_sql(jsonb, text) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.execute_sql(jsonb, text) IS 'Executes dynamic SQL with parameters. Used by edge functions to run complex queries.'; 