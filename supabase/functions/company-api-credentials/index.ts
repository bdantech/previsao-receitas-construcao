import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
Deno.serve(async (req)=>{
  // Create a Supabase client with the Auth context of the function
  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: {
      headers: {
        Authorization: req.headers.get('Authorization')
      }
    }
  });
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    // Get user ID from auth
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Check if user belongs to a company
    const { data: userCompany, error: userCompanyError } = await supabaseClient.from('user_companies').select('company_id').eq('user_id', user.id).single();
    if (userCompanyError || !userCompany) {
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
    // Process based on HTTP method
    if (req.method === 'GET') {
      // Get existing API credentials for this company
      const { data, error } = await supabaseClient.from('company_api_credentials').select('*').eq('company_id', companyId).order('created_at', {
        ascending: false
      });
      if (error) {
        console.error('Error fetching API credentials:', error);
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
      return new Response(JSON.stringify({
        credentials: data
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } else if (req.method === 'POST') {
      const requestData = await req.json();
      const action = requestData?.action;
      if (action === 'generate') {
        // First, invalidate any existing active credentials by setting active = false
        await supabaseClient.from('company_api_credentials').update({
          active: false
        }).eq('company_id', companyId).eq('active', true);
        // Generate new client ID and secret
        const clientId = crypto.randomUUID();
        // Generate a longer, more secure secret
        const clientSecret = Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b)=>b.toString(16).padStart(2, '0')).join('');
        // Insert new credentials
        const { data, error } = await supabaseClient.from('company_api_credentials').insert({
          company_id: companyId,
          client_id: clientId,
          client_secret: clientSecret,
          active: true,
          created_by: user.id
        }).select().single();
        if (error) {
          console.error('Error creating API credentials:', error);
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
        return new Response(JSON.stringify({
          success: true,
          credentials: data,
          message: 'Novas credenciais geradas com sucesso'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      } else if (action === 'deactivate' && requestData?.credentialId) {
        // Deactivate a specific credential
        const { error } = await supabaseClient.from('company_api_credentials').update({
          active: false
        }).eq('id', requestData.credentialId).eq('company_id', companyId);
        if (error) {
          console.error('Error deactivating API credentials:', error);
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
        return new Response(JSON.stringify({
          success: true,
          message: 'Credencial desativada com sucesso'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
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
    return new Response(JSON.stringify({
      error: 'Method not allowed'
    }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({
      error: 'Internal Server Error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
