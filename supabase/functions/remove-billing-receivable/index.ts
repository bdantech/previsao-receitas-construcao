import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables');
    }
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'Authentication required'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 401
      });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const reqClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    const { data: { user }, error: authError } = await reqClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({
        error: 'Authentication required'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 401
      });
    }
    const { data: profile, error: profileError } = await reqClient.from('profiles').select('role').eq('id', user.id).single();
    if (profileError) {
      return new Response(JSON.stringify({
        error: 'Error checking user permissions'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }
    if (profile.role !== 'admin') {
      return new Response(JSON.stringify({
        error: 'Admin access required'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 403
      });
    }
    const { billingReceivableId } = await req.json();
    if (!billingReceivableId) {
      return new Response(JSON.stringify({
        error: 'Invalid request data. Required: billingReceivableId'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    console.log(`Processing request to remove billing receivable ${billingReceivableId}`);
    // Get billing receivable details before deletion
    const { data: billingReceivable, error: brError } = await supabase.from('billing_receivables').select(`
        id,
        installment_id,
        receivable_id,
        receivables (
          amount
        )
      `).eq('id', billingReceivableId).single();
    if (brError || !billingReceivable) {
      console.error('Error fetching billing receivable:', brError);
      return new Response(JSON.stringify({
        error: `Billing receivable not found: ${billingReceivableId}`
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 404
      });
    }
    const installmentId = billingReceivable.installment_id;
    const receivableAmount = billingReceivable.receivables.amount;
    // Delete dependent boletos records first
    const { error: boletosDeleteError } = await supabase.from('boletos').delete().eq('billing_receivable_id', billingReceivableId);
    if (boletosDeleteError) {
      console.error('Error deleting dependent boletos:', boletosDeleteError);
      return new Response(JSON.stringify({
        error: `Error deleting dependent boletos: ${boletosDeleteError.message}`
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }
    console.log(`Successfully deleted dependent boletos for billing receivable ${billingReceivableId}`);
    // Now delete the billing receivable
    const { error: deleteError } = await supabase.from('billing_receivables').delete().eq('id', billingReceivableId);
    if (deleteError) {
      console.error('Error deleting billing receivable:', deleteError);
      return new Response(JSON.stringify({
        error: `Error deleting billing receivable: ${deleteError.message}`
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }
    console.log(`Successfully deleted billing receivable ${billingReceivableId}`);
    // Get installment details
    const { data: installment, error: installmentError } = await supabase.from('payment_plan_installments').select(`
        id,
        payment_plan_settings_id,
        numero_parcela,
        anticipation_request_id,
        payment_plan_settings (
          teto_fundo_reserva
        )
      `).eq('id', installmentId).single();
    if (installmentError || !installment) {
      throw new Error(`Error fetching installment: ${installmentError?.message || 'Installment not found'}`);
    }
    // Recalculate payment plan
    try {
      const { data: installments, error: installmentsError } = await supabase.from('payment_plan_installments').select('*').eq('payment_plan_settings_id', installment.payment_plan_settings_id).order('numero_parcela', {
        ascending: true
      });
      if (installmentsError) {
        throw new Error(`Error fetching installments: ${installmentsError.message}`);
      }
      const { data: anticipation, error: anticipationError } = await supabase.from('anticipation_requests').select('valor_total').eq('id', installment.anticipation_request_id).single();
      if (anticipationError) {
        throw new Error(`Error fetching anticipation request: ${anticipationError.message}`);
      }
      let saldoDevedor = anticipation.valor_total || 0;
      let fundoReserva = 0;
      const tetoFundoReserva = installment.payment_plan_settings.teto_fundo_reserva;
      console.log(`Starting recalculation with saldo_devedor: ${saldoDevedor}, teto_fundo_reserva: ${tetoFundoReserva}`);
      for (const inst of installments){
        if (inst.pmt === null || typeof inst.pmt !== 'number') continue;
        const { data: billingReceivables, error: brError } = await supabase.from('billing_receivables').select(`
            receivable_id,
            receivables (
              amount
            )
          `).eq('installment_id', inst.id);
        if (brError) {
          throw new Error(`Error fetching billing receivables: ${brError.message}`);
        }
        const recebiveis = billingReceivables.reduce((sum, br)=>sum + parseFloat(br.receivables.amount), 0);
        const currentContribution = recebiveis - inst.pmt;
        saldoDevedor = inst.numero_parcela === 0 ? anticipation.valor_total - inst.pmt : Math.max(0, saldoDevedor - inst.pmt);
        fundoReserva = inst.numero_parcela === 0 ? currentContribution : fundoReserva + currentContribution;
        let devolucao = 0;
        if (fundoReserva > tetoFundoReserva) {
          devolucao = fundoReserva - tetoFundoReserva;
          fundoReserva = tetoFundoReserva;
        }
        const { error: updateError } = await supabase.from('payment_plan_installments').update({
          saldo_devedor: saldoDevedor,
          fundo_reserva: fundoReserva,
          devolucao: devolucao,
          recebiveis: recebiveis
        }).eq('id', inst.id);
        if (updateError) {
          throw new Error(`Error updating installment ${inst.id}: ${updateError.message}`);
        }
        console.log(`Updated installment ${inst.numero_parcela}: saldo_devedor=${saldoDevedor}, fundo_reserva=${fundoReserva}, devolucao=${devolucao}, recebiveis=${recebiveis}`);
      }
      const { data: updatedInstallment, error: fetchError } = await supabase.from('payment_plan_installments').select('*').eq('id', installmentId).single();
      return new Response(JSON.stringify({
        success: true,
        message: 'Billing receivable and dependent boletos removed, payment plan recalculated',
        updatedInstallment: updatedInstallment
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    } catch (calcError) {
      console.error('Error in payment plan recalculation:', calcError);
      return new Response(JSON.stringify({
        success: true,
        warning: `Billing receivable and boletos were removed but payment plan recalculation failed: ${calcError.message}`
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
  } catch (error) {
    console.error('Error in remove-billing-receivable:', error);
    return new Response(JSON.stringify({
      error: error.message || 'An unexpected error occurred'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
