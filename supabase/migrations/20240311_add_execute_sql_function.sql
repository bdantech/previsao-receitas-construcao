-- Function to execute SQL queries safely
CREATE OR REPLACE FUNCTION public.execute_sql(query_text text, params jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    -- Execute the query and convert the result to JSON
    EXECUTE format('SELECT json_agg(row_to_json(t)) FROM (%s) t', query_text)
    INTO result
    USING params;
    
    -- Return empty array if null
    RETURN coalesce(result, '[]'::jsonb);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.execute_sql TO authenticated;

-- Revoke execute from public
REVOKE ALL ON FUNCTION public.execute_sql FROM public; 