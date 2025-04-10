import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing environment variables');
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    // Initialize Supabase client
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Authenticate user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    // Verify user is an admin
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403
      });
    }

    // Parse request body
    const { boletoIds } = await req.json();
    if (!boletoIds || !Array.isArray(boletoIds) || boletoIds.length === 0) {
      return new Response(JSON.stringify({ error: 'No boleto IDs provided' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Get the URL for the starkbank-integration function
    const starkbankFunctionUrl = `${supabaseUrl}/functions/v1/starkbank-integration`;

    const results = {
      successful: [],
      failed: []
    };

    // Process each boleto sequentially
    for (const boletoId of boletoIds) {
      try {
        // Call starkbank-integration function for each boleto
        const response = await fetch(starkbankFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            action: 'emitirBoleto',
            data: { boletoId }
          })
        });

        const result = await response.json();

        if (response.ok) {
          results.successful.push({
            boletoId,
            data: result.data
          });
        } else {
          results.failed.push({
            boletoId,
            error: result.error || 'Unknown error occurred'
          });
        }
      } catch (error) {
        results.failed.push({
          boletoId,
          error: error.message || 'Unknown error occurred'
        });
      }
    }

    // Return the results
    return new Response(JSON.stringify({
      message: 'Bulk boleto generation completed',
      results: {
        totalProcessed: boletoIds.length,
        successful: {
          count: results.successful.length,
          items: results.successful
        },
        failed: {
          count: results.failed.length,
          items: results.failed
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error in bulk-generate-boletos:', error);
    return new Response(JSON.stringify({
      error: `Server error: ${error.message}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
}); 