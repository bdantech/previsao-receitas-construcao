# Deploying the Credit Analysis SQL Function

To fix the ambiguous column reference issue, we need to deploy a new SQL function to the database. Follow these steps:

## Option 1: Using the Supabase Dashboard

1. Log in to the Supabase dashboard
2. Go to the SQL Editor
3. Create a new query
4. Paste the following SQL:

```sql
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
```

5. Run the query

## Option 2: Using the Supabase CLI

If you have the Supabase CLI installed, you can deploy the function using:

```bash
supabase functions deploy update-database-functions
```

## Option 3: Using the Edge Function

You can also invoke the edge function we created:

1. Go to the Supabase dashboard
2. Navigate to Edge Functions
3. Find and select the "update-database-functions" function
4. Click "Invoke" to run the function

After deploying the function, the application should be able to calculate anticipation values without encountering the ambiguous column reference error. 