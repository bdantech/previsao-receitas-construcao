# Deploying the SQL Functions

To fix the ambiguous column reference issues, we need to deploy new SQL functions to the database. Follow these steps:

## Option 1: Using the Supabase Dashboard

1. Log in to the Supabase dashboard
2. Go to the SQL Editor
3. Create a new query
4. Paste the following SQL:

```sql
-- Function 1: Credit Analysis Function
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

-- Function 2: Project Anticipations Function
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
```

5. Run the query

## Option 2: Using the Supabase CLI

If you have the Supabase CLI installed, you can deploy the functions using:

```bash
supabase functions deploy update-database-functions
```

## Option 3: Using the Edge Function

You can also invoke the edge function we created:

1. Go to the Supabase dashboard
2. Navigate to Edge Functions
3. Find and select the "update-database-functions" function
4. Click "Invoke" to run the function

## What These Functions Do

1. **get_active_credit_analysis_for_company**: Retrieves credit analysis data for a company without ambiguous column references
2. **get_project_anticipations**: Retrieves anticipation requests for a project without ambiguous column references

After deploying these functions, the application should be able to calculate anticipation values and list anticipation requests without encountering the ambiguous column reference errors. 