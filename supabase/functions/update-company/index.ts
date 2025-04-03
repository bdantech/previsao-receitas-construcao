import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
// Configuração CORS para permitir chamadas do frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  // Tratamento para requisições OPTIONS (preflight CORS)
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    // Obter URL da Supabase e chave anônima das variáveis de ambiente
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey || !supabaseServiceKey) {
      throw new Error('Missing environment variables');
    }
    // Obter o token de autorização do cabeçalho
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'Autorização não fornecida'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 401
      });
    }
    // Usar o token para autenticar o cliente do Supabase
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    // Autenticação e informações do usuário
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError) {
      console.error('Auth error:', authError);
      throw authError;
    }
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Autenticação necessária'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 401
      });
    }
    console.log('User authenticated:', user.id);
    // Parse the request body
    const { companyId, updates } = await req.json();
    if (!companyId || !updates) {
      return new Response(JSON.stringify({
        error: 'Parâmetros insuficientes'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    // Use service role client for database operations
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    // Check if user is associated with this company
    const { data: userCompanies, error: relationError } = await adminSupabase.from('user_companies').select('company_id').eq('user_id', user.id).eq('company_id', companyId);
    if (relationError) {
      console.error('User companies error:', relationError);
      return new Response(JSON.stringify({
        error: 'Erro ao verificar relação entre usuário e empresa'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }
    if (userCompanies.length === 0) {
      return new Response(JSON.stringify({
        error: 'Usuário não autorizado a atualizar esta empresa'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 403
      });
    }
    // Update company
    const { data: company, error: updateError } = await adminSupabase.from('companies').update({
      name: updates.name,
      website: updates.website
    }).eq('id', companyId).select().single();
    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(JSON.stringify({
        error: 'Erro ao atualizar empresa: ' + updateError.message
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }
    console.log('Company updated:', company);
    return new Response(JSON.stringify({
      success: true,
      company
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error("Error in update-company function:", error);
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
