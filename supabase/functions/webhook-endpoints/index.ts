import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';
// CORS configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS'
};
serve(async (req)=>{
  // Handle CORS preflight requests
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
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'No authorization header'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 401
      });
    }
    // Initialize service role client for admin operations
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    // Extract the JWT token and verify the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        details: authError
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 401
      });
    }
    // Verify user is an admin
    const { data: profile, error: profileError } = await adminSupabase.from('profiles').select('role').eq('id', user.id).single();
    if (profileError || !profile || profile.role !== 'admin') {
      console.error('Profile error:', profileError);
      return new Response(JSON.stringify({
        error: 'Unauthorized - Admin access required'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 403
      });
    }
    // Parse request body
    let requestData;
    try {
      const text = await req.text();
      console.log('Request body:', text);
      requestData = text ? JSON.parse(text) : {};
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return new Response(JSON.stringify({
        error: 'Invalid request body',
        details: parseError.message
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    if (req.method === 'POST') {
      // Create new webhook endpoint
      const { tag, description } = requestData;
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
      const { data, error } = await adminSupabase.from('webhook_endpoints').insert({
        url_path: urlPath,
        tag,
        description
      }).select().single();
      if (error) {
        console.error('Insert error:', error);
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
      const { id } = requestData;
      if (!id) {
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
      // Delete the webhook endpoint
      const { error } = await adminSupabase.from('webhook_endpoints').delete().eq('id', id);
      if (error) {
        console.error('Delete error:', error);
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
