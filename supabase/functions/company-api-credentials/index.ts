import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const SUPABASE_URL = 'https://hshfqxjrilqzjpkcotgz.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzaGZxeGpyaWxxempwa2NvdGd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTUzMDg0NywiZXhwIjoyMDU3MTA2ODQ3fQ.n1hwt_9E8COHOlQ0TvA2bF3B44YegItf7jmWMH_yghg';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    console.log("Auth header present:", !!authHeader);
    
    if (!authHeader) {
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

    // Create a Supabase admin client
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get the JWT token from the Authorization header
    const jwt = authHeader.replace('Bearer ', '');
    console.log("JWT token length:", jwt?.length);

    // Verify the JWT token using the admin client
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);

    if (authError) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({
        error: 'Authentication failed',
        details: authError.message
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    if (!user) {
      return new Response(JSON.stringify({
        error: 'User not found'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log("Authenticated user:", user.id);

    // Check if user belongs to a company
    const { data: userCompany, error: companyError } = await supabaseAdmin
      .from('user_companies')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (companyError || !userCompany) {
      console.error("Company lookup error:", companyError);
      return new Response(JSON.stringify({
        error: 'User not associated with any company'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const companyId = userCompany.company_id;
    console.log("Found company ID:", companyId);

    // Get the request body for POST methods
    let requestData = {};
    if (req.method === 'POST') {
      try {
        requestData = await req.json();
      } catch (e) {
        console.error("Failed to parse request body:", e);
        requestData = {};
      }
    }

    const action = req.method === 'GET' ? 'list' : requestData?.action;
    console.log("Processing action:", action);

    switch (action) {
      case 'list':
        // Get existing API credentials for this company
        const { data: credentials, error: fetchError } = await supabaseAdmin
          .from('company_api_credentials')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('Error fetching API credentials:', fetchError);
          return new Response(JSON.stringify({
            error: fetchError.message
          }), {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }

        return new Response(JSON.stringify({
          credentials
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });

      case 'generate':
        // First, invalidate any existing active credentials
        await supabaseAdmin
          .from('company_api_credentials')
          .update({ active: false })
          .eq('company_id', companyId)
          .eq('active', true);

        // Generate new credentials
        const clientId = crypto.randomUUID();
        const clientSecret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        // Insert new credentials
        const { data: newCred, error: insertError } = await supabaseAdmin
          .from('company_api_credentials')
          .insert({
            company_id: companyId,
            client_id: clientId,
            client_secret: clientSecret,
            active: true,
            created_by: user.id
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating API credentials:', insertError);
          return new Response(JSON.stringify({
            error: insertError.message
          }), {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          credentials: newCred,
          message: 'Novas credenciais geradas com sucesso'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });

      case 'deactivate':
        const credentialId = requestData?.credentialId;
        if (!credentialId) {
          return new Response(JSON.stringify({
            error: 'Missing credential ID'
          }), {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }

        const { error: deactivateError } = await supabaseAdmin
          .from('company_api_credentials')
          .update({ active: false })
          .eq('id', credentialId)
          .eq('company_id', companyId);

        if (deactivateError) {
          console.error('Error deactivating API credentials:', deactivateError);
          return new Response(JSON.stringify({
            error: deactivateError.message
          }), {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Credencial desativada com sucesso'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });

      default:
        return new Response(JSON.stringify({
          error: 'Invalid action'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
    }
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
