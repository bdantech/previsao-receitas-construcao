import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
// CORS configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables');
    }
    // Initialize Supabase client with Service Role Key (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('Updating database functions to fix billing receivables deletion issue...');
    // Check if there are any triggers that might be causing billing receivables to be deleted
    const { data: triggers, error: triggersError } = await supabase.rpc('execute_sql', {
      params: {},
      query_text: `
        SELECT trigger_name, event_manipulation, action_statement
        FROM information_schema.triggers
        WHERE event_object_table = 'billing_receivables'
        ORDER BY trigger_name;
      `
    });
    if (triggersError) {
      console.error('Error checking triggers:', triggersError);
      throw triggersError;
    }
    console.log('Billing receivables triggers:', triggers);
    // Verify the calculate_payment_plan_installments function to ensure it's not accidentally deleting receivables
    const { data: updated, error: updateError } = await supabase.rpc('execute_sql', {
      params: {},
      query_text: `
        CREATE OR REPLACE FUNCTION public.calculate_payment_plan_installments(p_payment_plan_settings_id uuid)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $function$
        DECLARE
          v_teto_fundo_reserva DECIMAL(10, 2);
          v_anticipation_request_id UUID;
          v_saldo_devedor DECIMAL(10, 2);
          v_installment RECORD;
        BEGIN
          -- Get teto_fundo_reserva from payment_plan_settings
          SELECT 
            pps.teto_fundo_reserva,
            pps.anticipation_request_id
          INTO 
            v_teto_fundo_reserva,
            v_anticipation_request_id
          FROM 
            payment_plan_settings pps
          WHERE 
            pps.id = p_payment_plan_settings_id;

          -- Get initial saldo_devedor from anticipation request valor_liquido
          SELECT ar.valor_liquido INTO v_saldo_devedor
          FROM anticipation_requests ar
          WHERE ar.id = v_anticipation_request_id;

          -- Log for debugging
          RAISE NOTICE 'Starting saldo_devedor: % from anticipation %', v_saldo_devedor, v_anticipation_request_id;
          RAISE NOTICE 'Manually recalculating installments with teto_fundo_reserva: %', v_teto_fundo_reserva;

          -- Process installments in order
          FOR v_installment IN 
            SELECT 
              ppi.*
            FROM 
              payment_plan_installments ppi
            WHERE 
              ppi.payment_plan_settings_id = p_payment_plan_settings_id
            ORDER BY 
              ppi.numero_parcela
          LOOP
            -- Apply logic based on installment number
            IF v_installment.numero_parcela = 0 THEN
              -- First installment - recebiveis already set, determine devolucao
              IF v_installment.recebiveis > v_installment.pmt THEN
                -- If recebiveis > PMT, the difference goes to devolucao
                UPDATE payment_plan_installments
                SET 
                  saldo_devedor = v_saldo_devedor - v_installment.pmt,
                  fundo_reserva = v_teto_fundo_reserva,
                  devolucao = v_installment.recebiveis - v_installment.pmt
                WHERE id = v_installment.id;
              ELSE
                -- If recebiveis <= PMT, devolucao is 0
                UPDATE payment_plan_installments
                SET 
                  saldo_devedor = v_saldo_devedor - v_installment.pmt,
                  fundo_reserva = v_teto_fundo_reserva,
                  devolucao = 0
                WHERE id = v_installment.id;
              END IF;
            ELSE
              -- Subsequent installments - calculate fundo_reserva
              UPDATE payment_plan_installments
              SET 
                saldo_devedor = v_saldo_devedor - v_installment.pmt,
                -- Fundo reserva decreases as we pay installments
                fundo_reserva = v_teto_fundo_reserva - (v_teto_fundo_reserva * v_installment.numero_parcela / 
                  (SELECT COUNT(*) FROM payment_plan_installments 
                   WHERE payment_plan_settings_id = p_payment_plan_settings_id)),
                devolucao = 0
              WHERE id = v_installment.id;
            END IF;
            
            -- Update running saldo_devedor
            v_saldo_devedor := v_saldo_devedor - v_installment.pmt;
            
            -- Log each installment update
            RAISE NOTICE 'Updated installment % (%): saldo_devedor=%, fundo_reserva=%, devolucao=%', 
              v_installment.numero_parcela, v_installment.id, v_saldo_devedor, 
              (SELECT fundo_reserva FROM payment_plan_installments WHERE id = v_installment.id),
              (SELECT devolucao FROM payment_plan_installments WHERE id = v_installment.id);
          END LOOP;
          
          RAISE NOTICE 'Manual payment plan recalculation succeeded';
        END;
        $function$;
      `
    });
    if (updateError) {
      console.error('Error updating calculate_payment_plan_installments function:', updateError);
      throw updateError;
    }
    console.log('Database functions updated successfully to fix billing receivables deletion issue');
    return new Response(JSON.stringify({
      success: true,
      message: 'Database functions updated successfully to fix billing receivables deletion issue'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error updating database functions:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
