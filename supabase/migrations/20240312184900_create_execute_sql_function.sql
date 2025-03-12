-- Create a function to execute dynamic SQL with parameters
CREATE OR REPLACE FUNCTION public.execute_sql(params jsonb, query_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
    param_array text[];
BEGIN
    -- Convert params to text array, preserving string values
    SELECT array_agg(
        CASE 
            WHEN jsonb_typeof(value) IN ('string', 'null') THEN value #>> '{}'
            ELSE value::text
        END
    )
    INTO param_array
    FROM jsonb_array_elements(params);

    -- Execute the query with the parameters
    EXECUTE format('SELECT array_to_json(array_agg(row_to_json(t)))::jsonb FROM (%s) t', query_text)
    INTO result
    USING VARIADIC param_array;
    
    RETURN coalesce(result, '[]'::jsonb);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'error', SQLERRM,
        'detail', SQLSTATE,
        'query', query_text,
        'params', params
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.execute_sql(jsonb, text) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.execute_sql(jsonb, text) IS 'Executes dynamic SQL with parameters. Used by edge functions to run complex queries.'; 