import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

// CORS configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey || !supabaseServiceKey) {
      throw new Error('Missing environment variables');
    }

    // Get authorization header
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

    // Initialize Supabase client with user's auth token for auth verification
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

    // Service client for admin operations (bypasses RLS)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
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

    // Verify user is an admin
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return new Response(JSON.stringify({
        error: 'Forbidden: Only admins can manage webhook endpoints'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 403
      });
    }

    // Handle different HTTP methods
    if (req.method === 'POST') {
      // Create new webhook endpoint
      const { tag, description } = await req.json();

      if (!tag) {
        return new Response(JSON.stringify({
          error: 'Tag is required'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 400
        });
      }

      // Generate a unique URL path
      const urlPath = `webhook-${crypto.randomUUID()}`;

      // Insert the new webhook endpoint
      const { data, error } = await serviceClient
        .from('webhook_endpoints')
        .insert({
          url_path: urlPath,
          tag,
          description
        })
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({
          error: error.message
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 400
        });
      }

      return new Response(JSON.stringify(data), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 201
      });
    }

    if (req.method === 'DELETE') {
      // Delete webhook endpoint
      const url = new URL(req.url);
      const endpointId = url.searchParams.get('id');

      if (!endpointId) {
        return new Response(JSON.stringify({
          error: 'Endpoint ID is required'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 400
        });
      }

      // Delete the webhook endpoint (cascade will delete related events)
      const { error } = await serviceClient
        .from('webhook_endpoints')
        .delete()
        .eq('id', endpointId);

      if (error) {
        return new Response(JSON.stringify({
          error: error.message
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 400
        });
      }

      return new Response(null, {
        headers: corsHeaders,
        status: 204
      });
    }

    return new Response(JSON.stringify({
      error: 'Method not allowed'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 405
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