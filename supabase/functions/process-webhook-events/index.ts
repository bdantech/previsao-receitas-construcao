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
