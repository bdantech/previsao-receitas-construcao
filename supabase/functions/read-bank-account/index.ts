import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
// CORS headers configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'Não autorizado: Token não fornecido'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get Supabase configuration
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey || !supabaseServiceKey) {
      console.error('Missing environment variables:', {
        url: !!supabaseUrl,
        key: !!supabaseKey,
        serviceKey: !!supabaseServiceKey
      });
      return new Response(JSON.stringify({
        error: 'Configuração do servidor incompleta'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    try {
      // Initialize Supabase clients
      const supabase = createClient(supabaseUrl, supabaseKey);
      const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
      // Get user from token
      const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (userError) {
        console.error('User authentication error:', userError);
        return new Response(JSON.stringify({
          error: 'Não autorizado: Token inválido'
        }), {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      if (!user) {
        console.error('No user found with token');
        return new Response(JSON.stringify({
          error: 'Usuário não encontrado'
        }), {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      console.log('User authenticated:', user.id);
      // Get user's companies
      const { data: userCompanies, error: companiesError } = await adminSupabase.from('user_companies').select('company_id').eq('user_id', user.id);
      if (companiesError) {
        console.error('Companies error:', companiesError);
        return new Response(JSON.stringify({
          error: 'Erro ao buscar empresas do usuário',
          details: companiesError.message
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      if (!userCompanies || userCompanies.length === 0) {
        console.log('No companies found for user:', user.id);
        return new Response(JSON.stringify({
          bankAccounts: []
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      }
      const companyIds = userCompanies.map((uc)=>uc.company_id);
      console.log('Found company IDs:', companyIds);
      try {
        // Get bank accounts for user's companies
        const { data: bankAccounts, error: bankAccountsError } = await adminSupabase.from('bank_accounts').select(`
            id,
            account_name,
            account_number,
            balance,
            bank_account_url,
            company_id,
            project_id,
            created_at,
            updated_at
          `).in('company_id', companyIds);
        if (bankAccountsError) {
          console.error('Bank accounts error:', bankAccountsError);
          return new Response(JSON.stringify({
            error: 'Erro ao buscar contas bancárias',
            details: bankAccountsError.message
          }), {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
        console.log('Found bank accounts:', JSON.stringify(bankAccounts, null, 2));
        return new Response(JSON.stringify({
          bankAccounts: bankAccounts || []
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      } catch (dbError) {
        console.error('Database query error:', dbError);
        return new Response(JSON.stringify({
          error: 'Erro ao consultar banco de dados',
          details: dbError instanceof Error ? dbError.message : 'Unknown database error'
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (clientError) {
      console.error('Supabase client error:', clientError);
      return new Response(JSON.stringify({
        error: 'Erro ao inicializar cliente Supabase',
        details: clientError instanceof Error ? clientError.message : 'Unknown client error'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
