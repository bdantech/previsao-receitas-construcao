import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};
const LIQUIDPASS_API_URL = 'https://api.dev.liquidpass.co/analysis/integration/run';
const LIQUIDPASS_CLIENT_ID = Deno.env.get('LIQUIDPASS_CLIENT_ID');
const LIQUIDPASS_SECRET_TOKEN = Deno.env.get('LIQUIDPASS_SECRET_TOKEN');
const LIQUIDPASS_PRODUCT_ID = Deno.env.get('LIQUIDPASS_PRODUCT_ID');

const CALLBACK_URL = 'https://hshfqxjrilqzjpkcotgz.supabase.co/functions/v1/webhook-events/webhook-2fc7e7b3-842d-4145-9414-43839f8699b3';

serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    // Get supabase client with auth context from request
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      return new Response(JSON.stringify({
        error: 'Missing authorization header'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: authorization
        }
      },
      auth: {
        persistSession: false
      }
    });
    // Verify the user is an admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Not authenticated'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Verify user is an admin
    const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profileError || profile?.role !== 'admin') {
      console.error('Admin verification failed:', profileError || 'Not an admin');
      return new Response(JSON.stringify({
        error: 'Unauthorized - Admin access required'
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get the request body
    const requestData = await req.json();
    const { projectBuyers } = requestData;
    if (!projectBuyers || !Array.isArray(projectBuyers) || projectBuyers.length === 0) {
      return new Response(JSON.stringify({
        error: 'No project buyers provided'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Process each project buyer separately
    const results = [];
    for (const buyer of projectBuyers){
      try {
        const response = await fetch(LIQUIDPASS_API_URL, {
          method: 'POST',
          headers: {
            'client_id': LIQUIDPASS_CLIENT_ID,
            'secret_token': LIQUIDPASS_SECRET_TOKEN,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            product_id: LIQUIDPASS_PRODUCT_ID,
            callback_url: CALLBACK_URL,
            allow_peer_not_found: true,
            peers: [
              {
                document: buyer.cpf,
                peer: 'Cliente CPF'
              }
            ]
          })
        });
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Error calling LiquidPass API:', errorData);
          results.push({
            cpf: buyer.cpf,
            success: false,
            error: `Failed to process analysis: ${response.statusText}`
          });
          continue;
        }
        const result = await response.json();
        results.push({
          cpf: buyer.cpf,
          success: true,
          data: result
        });
      } catch (error) {
        console.error('Error processing buyer:', buyer.cpf, error);
        results.push({
          cpf: buyer.cpf,
          success: false,
          error: error.message
        });
      }
    }
    return new Response(JSON.stringify({
      success: true,
      data: results
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
