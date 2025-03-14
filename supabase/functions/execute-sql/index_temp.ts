
// This is a temporary file to execute SQL for updating the database function
// that will be called through the edge function

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

serve(async (req) => {
  // Get the Database URL and Service Role Key from environment variables
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Missing environment variables' }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }

  // Initialize Supabase client with Service Role Key (bypasses RLS)
  const supabase = createClient(
    supabaseUrl,
    supabaseServiceKey
  )

  try {
    // Update the calculate_anticipation_valor_liquido function to fix ambiguous column reference
    const { data, error } = await supabase.rpc('execute_sql', {
      params: {},
      query_text: `
        CREATE OR REPLACE FUNCTION public.calculate_anticipation_valor_liquido(p_receivable_ids uuid[], p_company_id uuid)
        RETURNS numeric
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $function$
        DECLARE
          v_valor_total NUMERIC := 0;
          v_valor_liquido NUMERIC := 0;
          v_interest_deduction NUMERIC := 0;
          v_fee_deduction NUMERIC := 0;
          v_quantidade_recebiveis INTEGER := 0;
          v_tarifa_por_recebivel NUMERIC;
          v_rec RECORD;
          v_interest_rate NUMERIC;
          v_days_to_due INTEGER;
        BEGIN
          -- Get the fee per receivable from company credit analysis
          SELECT fee_per_receivable INTO v_tarifa_por_recebivel
          FROM company_credit_analysis
          WHERE company_credit_analysis.company_id = p_company_id AND status = 'Ativa'
          LIMIT 1;
          
          IF v_tarifa_por_recebivel IS NULL THEN
            RAISE EXCEPTION 'No active credit analysis found for company';
          END IF;
          
          -- Process each receivable
          v_quantidade_recebiveis := array_length(p_receivable_ids, 1);
          IF v_quantidade_recebiveis IS NULL OR v_quantidade_recebiveis = 0 THEN
            RAISE EXCEPTION 'At least one receivable is required';
          END IF;
          
          -- Calculate fee deduction
          v_fee_deduction := v_quantidade_recebiveis * v_tarifa_por_recebivel;
          
          -- Calculate interest deduction for each receivable
          FOR v_rec IN 
            SELECT r.id, r.amount, r.due_date
            FROM receivables r
            WHERE r.id = ANY(p_receivable_ids)
          LOOP
            v_valor_total := v_valor_total + v_rec.amount;
            
            -- Calculate days between today and due date
            v_days_to_due := (v_rec.due_date - CURRENT_DATE);
            
            -- Get appropriate interest rate based on days to due
            v_interest_rate := public.get_company_interest_rate(p_company_id, v_days_to_due);
            
            -- Calculate interest deduction for this receivable
            v_interest_deduction := v_interest_deduction + (v_rec.amount * v_interest_rate / 100);
          END LOOP;
          
          -- Calculate final valor liquido
          v_valor_liquido := v_valor_total - v_interest_deduction - v_fee_deduction;
          
          RETURN v_valor_liquido;
        END;
        $function$;
        
        -- Also fix the get_company_interest_rate function to avoid ambiguous column references
        CREATE OR REPLACE FUNCTION public.get_company_interest_rate(p_company_id uuid, p_days integer)
        RETURNS numeric
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $function$
        DECLARE
          v_interest_rate DECIMAL(10, 2);
        BEGIN
          SELECT
            CASE 
              WHEN p_days <= 180 THEN interest_rate_180
              WHEN p_days <= 360 THEN interest_rate_360
              WHEN p_days <= 720 THEN interest_rate_720
              ELSE interest_rate_long_term
            END INTO v_interest_rate
          FROM public.company_credit_analysis
          WHERE company_credit_analysis.company_id = p_company_id AND status = 'Ativa'
          LIMIT 1;
          
          RETURN v_interest_rate;
        EXCEPTION WHEN OTHERS THEN
          RETURN NULL;
        END;
        $function$;
      `
    });

    if (error) {
      console.error('Error updating functions:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Database functions updated successfully',
        data
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
