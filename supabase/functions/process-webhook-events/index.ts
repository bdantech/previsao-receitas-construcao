import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
// CORS configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
// Map of boleto statuses to status_pagamento values
const statusMapping = {
  'registered': 'Em Aberto',
  'paid': 'Pago',
  'credited': 'Pago',
  'overdue': 'Em Atraso'
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
    // Initialize Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Get the request body
    const { record } = await req.json();
    if (!record) {
      throw new Error('No record provided in the request');
    }
    // Get the webhook endpoint details
    const { data: endpoint, error: endpointError } = await supabase.from('webhook_endpoints').select('*').eq('id', record.endpoint_id).single();
    if (endpointError) {
      throw new Error(`Error fetching webhook endpoint: ${endpointError.message}`);
    }
    // Process based on endpoint tag
    if (endpoint.tag === 'Boleto') {
      try {
        const payload = record.payload;
        // Extract boleto information from payload
        const boletoId = payload.event.log.boleto.id;
        const status = payload.event.log.boleto.status;
        const fee = payload.event.log.boleto.fee;
        // Validate status
        if (!statusMapping[status]) {
          throw new Error(`Invalid boleto status: ${status}`);
        }
        // Find the boleto in our database
        const { data: boleto, error: boletoError } = await supabase.from('boletos').select('*').eq('external_id', boletoId).single();
        if (boletoError) {
          throw new Error(`Error finding boleto: ${boletoError.message}`);
        }
        if (!boleto) {
          throw new Error(`Boleto with external_id ${boletoId} not found`);
        }
        // Update the boleto status
        const { error: updateError } = await supabase.from('boletos').update({
          status_pagamento: statusMapping[status],
          updated_at: new Date().toISOString(),
          fee_amount: fee ? fee : null
        }).eq('id', boleto.id);
        if (updateError) {
          throw new Error(`Error updating boleto: ${updateError.message}`);
        }
        // Só deduz crédito se estiver pago
        if (statusMapping[status] === 'Pago') {
          const { data: billing_receivable } = await supabase.from('billing_receivables').select('*').eq('id', boleto.billing_receivable_id).single();
          if (!billing_receivable) throw new Error(`Recebível de cobrança não encontrado`);
          console.log('billing_receivable');
          console.log(billing_receivable);
          const { data: pmt_receivables } = await supabase.from('pmt_receivables').select('*').eq('receivable_id', billing_receivable.receivable_id);
          console.log('pmt_receivables');
          console.log(pmt_receivables);
          if (pmt_receivables) {
            console.log('Entrou em pmt_receivables');
            const { data: analise } = await supabase.from('company_credit_analysis').select('*').eq('company_id', boleto.company_id).eq('status', 'Ativa').single();
            console.log('analise');
            console.log(analise);
            if (!analise) throw new Error(`Análise de crédito ativa não encontrada para a empresa`);
            const novoConsumido = Number(analise.consumed_credit || 0) - Number(boleto.valor_face);
            console.log('novoConsumido: ' + novoConsumido);
            const { error: updateCreditoError } = await supabase.from('company_credit_analysis').update({
              consumed_credit: novoConsumido
            }).eq('id', analise.id);
            if (updateCreditoError) {
              throw new Error(`Erro ao atualizar crédito consumido: ${updateCreditoError.message}`);
            }
          }
        }
        // Update the webhook event as processed
        const { error: eventUpdateError } = await supabase.from('webhook_events').update({
          processed: true,
          processing_result: {
            success: true,
            message: `Boleto status updated to ${statusMapping[status]}`
          }
        }).eq('id', record.id);
        if (eventUpdateError) {
          console.error('Error updating webhook event:', eventUpdateError);
        }
        return new Response(JSON.stringify({
          success: true,
          message: `Boleto status updated to ${statusMapping[status]}`
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      } catch (error) {
        // Update the webhook event with error information
        await supabase.from('webhook_events').update({
          processed: true,
          processing_result: {
            success: false,
            error: error.message
          }
        }).eq('id', record.id);
        throw error;
      }
    }
    if (endpoint.tag === 'Liquid Pass') {
      const payload = record.payload;
      const status = payload.status;
      const analyseId = payload.analysis_id;
      // find analysisId in project_buyers table
      const { data: projectBuyer, error: projectBuyerError } = await supabase.from('project_buyers').select('*').eq('external_analysis_id', analyseId).single();
      if (projectBuyerError) {
        throw new Error(`Error finding project buyer: ${projectBuyerError.message}`);
      }
      if (!projectBuyer) {
        throw new Error(`Project buyer with external_analysis_id ${analyseId} not found`);
      }
      const mapStatus = {
        match: 'aprovado',
        'unmatch': 'reprovado',
        'onboarding': 'moderacao',
        'moderation': 'moderacao'
      };
      const updatedStatus = mapStatus[status];
      if (!updatedStatus) {
        throw new Error(`Invalid status: ${status}`);
      }
      // Update the project buyer status
      const { error: updateError } = await supabase.from('project_buyers').update({
        credit_analysis_status: updatedStatus,
        updated_at: new Date().toISOString()
      }).eq('id', projectBuyer.id);
      if (updateError) {
        throw new Error(`Error updating project buyer: ${updateError.message}`);
      }
      // Update the webhook event as processed
      const { error: eventUpdateError } = await supabase.from('webhook_events').update({
        processed: true,
        processing_result: {
          success: true,
          message: `Project buyer credit_analysis_status updated to ${updatedStatus}`
        }
      }).eq('id', record.id);
      if (eventUpdateError) {
        console.error('Error updating webhook event:', eventUpdateError);
      }
      return new Response(JSON.stringify({
        success: true,
        message: `Project buyer credit_analysis_status updated to ${updatedStatus}`
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
    // If the tag is not handled, mark as processed
    await supabase.from('webhook_events').update({
      processed: true,
      processing_result: {
        success: true,
        message: 'No action required for this webhook tag'
      }
    }).eq('id', record.id);
    return new Response(JSON.stringify({
      success: true,
      message: 'Webhook event processed'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error processing webhook event:', error);
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
