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
      console.error('Error deploying function:', error);
      throw error;
    }

    console.log('Function deployed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Function deployed successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error deploying function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
}); 