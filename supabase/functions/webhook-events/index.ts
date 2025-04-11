import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
// CORS configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
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
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    // Get the URL path from the request
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const urlPath = pathParts[pathParts.length - 1];
    // Find the webhook endpoint
    const { data: endpoint, error: endpointError } = await adminSupabase.from('webhook_endpoints').select('id').eq('url_path', urlPath).single();
    if (endpointError || !endpoint) {
      return new Response(JSON.stringify({
        error: 'Webhook endpoint not found'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 404
      });
    }
    // Get the request payload and headers
    const payload = await req.json();
    if (!payload) {
      throw new Error('Payload cannot be null or undefined');
    }
    const headers = Object.fromEntries(req.headers.entries());
    // Save the webhook event
    const { error: eventError, data: eventData } = await adminSupabase.from('webhook_events').insert({
      endpoint_id: endpoint.id,
      payload,
      headers,
      processed: false
    }).select().single();
    if (eventError) {
      console.error('Error saving webhook event:', eventError);
      return new Response(JSON.stringify({
        error: 'Failed to save webhook event'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }
    const { error: processEventError } = await adminSupabase.functions.invoke('process-webhook-events', {
      body: {
        record: {
          id: eventData.id,
          endpoint_id: endpoint.id,
          payload,
          headers,
          processed: false
        }
      }
    });
    if (processEventError) {
      console.error('Error processing webhook event:', processEventError);
      return new Response(JSON.stringify({
        error: 'Failed to process webhook event'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }
    // Return success response
    return new Response(JSON.stringify({
      message: 'Webhook event received and saved successfully'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error:', error);
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
