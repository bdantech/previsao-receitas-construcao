import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

// CORS configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables')
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey
    )

    // Deploy the get_active_credit_analysis_for_company function
    const { data, error } = await supabase.rpc('execute_sql', {
      params: {},
      query_text: `
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
      `
    });

    if (error) {
      console.error('Error deploying credit analysis function:', error);
      throw error;
    }

    // Deploy the get_project_anticipations function
    const { data: data2, error: error2 } = await supabase.rpc('execute_sql', {
      params: {},
      query_text: `
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
      `
    });

    if (error2) {
      console.error('Error deploying project anticipations function:', error2);
      throw error2;
    }

    console.log('Database functions deployed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Database functions deployed successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error deploying database functions:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
}); 