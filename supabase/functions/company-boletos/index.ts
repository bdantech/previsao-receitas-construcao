import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
// CORS configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
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
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseKey) {
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
    // Initialize Supabase client with user's auth token
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
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
    // Get user's companies
    const { data: userCompanies, error: companiesError } = await supabaseClient.from('user_companies').select('company_id').eq('user_id', user.id);
    if (companiesError) {
      console.error('Error fetching user companies:', companiesError);
      return new Response(JSON.stringify({
        error: 'Error fetching user companies'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }
    const companyIds = userCompanies.map((uc)=>uc.company_id);
    if (companyIds.length === 0) {
      return new Response(JSON.stringify({
        error: 'No associated companies found'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 403
      });
    }
    // Parse request
    const { action, data } = await req.json();
    console.log(`Received action: ${action}`, data);
    // Handle different actions
    switch(action){
      case 'getBoletos':
        {
          const { filters } = data || {};
          return await handleGetBoletos(supabaseClient, companyIds, filters, corsHeaders);
        }
      default:
        return new Response(JSON.stringify({
          error: 'Invalid action'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 400
        });
    }
  } catch (error) {
    console.error("Error in company-boletos function:", error);
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
async function handleGetBoletos(supabaseClient, companyIds, filters, corsHeaders) {
  console.log('Getting boletos for companies:', companyIds, 'with filters:', filters);
  let query = supabaseClient.from('boletos').select(`
      id,
      billing_receivable_id,
      valor_face,
      valor_boleto,
      percentual_atualizacao,
      data_vencimento,
      data_emissao,
      nosso_numero,
      linha_digitavel,
      arquivo_boleto_path,
      arquivo_boleto_name,
      status_emissao,
      status_pagamento,
      payer_tax_id,
      project_tax_id,
      project_id,
      company_id,
      created_at,
      updated_at,
      index_id,
      indexes:index_id (
        id,
        name
      ),
      projects:project_id (
        id,
        name
      ),
      companies:company_id (
        id,
        name
      ),
      billing_receivables:billing_receivable_id (
        id,
        receivable_id,
        installment_id,
        nova_data_vencimento,
        receivables:receivable_id (
          id,
          amount,
          buyer_name,
          buyer_cpf,
          due_date
        ),
        payment_installments:installment_id (
          id,
          pmt,
          data_vencimento,
          numero_parcela
        )
      )
    `).in('company_id', companyIds);
  // Apply filters if provided
  if (filters) {
    if (filters.projectId) {
      query = query.eq('project_id', filters.projectId);
    }
    if (filters.statusEmissao) {
      query = query.eq('status_emissao', filters.statusEmissao);
    }
    if (filters.statusPagamento) {
      query = query.eq('status_pagamento', filters.statusPagamento);
    }
    if (filters.fromDate) {
      query = query.gte('data_vencimento', filters.fromDate);
    }
    if (filters.toDate) {
      query = query.lte('data_vencimento', filters.toDate);
    }
  }
  const { data: boletos, error } = await query.order('data_vencimento', {
    ascending: true
  });
  if (error) {
    console.error('Error fetching boletos:', error);
    throw error;
  }
  return new Response(JSON.stringify({
    boletos,
    count: boletos.length
  }), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    },
    status: 200
  });
}
