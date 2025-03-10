
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

// Configuração CORS para permitir chamadas do frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Tratamento para requisições OPTIONS (preflight CORS)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Obter URL da Supabase e chave anônima das variáveis de ambiente
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey || !supabaseServiceKey) {
      throw new Error('Missing environment variables')
    }

    // Obter o token de autorização do cabeçalho
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autorização não fornecida' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    // Usar o token para autenticar o cliente do Supabase
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseKey,
      {
        global: {
          headers: {
            Authorization: authHeader
          },
        },
      }
    )

    // Autenticação e informações do usuário
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    
    if (authError) {
      console.error('Auth error:', authError)
      throw authError
    }
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    console.log('User authenticated:', user.id)

    // Verificar o papel do usuário
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Profile error:', profileError)
      throw profileError
    }

    console.log('User role:', profile.role)

    // Se o usuário for administrador, retornar todas as empresas
    if (profile.role === 'admin') {
      const { data: companies, error: companiesError } = await supabaseClient
        .from('companies')
        .select('*')
        .order('name')

      if (companiesError) {
        console.error('Companies error:', companiesError)
        throw companiesError
      }

      return new Response(
        JSON.stringify({ companies }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    } 
    // Se for usuário de empresa, retornar apenas suas empresas associadas
    else {
      const { data: userCompanies, error: relationError } = await supabaseClient
        .from('user_companies')
        .select('company_id')
        .eq('user_id', user.id)

      if (relationError) {
        console.error('User companies error:', relationError)
        throw relationError
      }

      console.log('User companies:', userCompanies)

      const companyIds = userCompanies.map(uc => uc.company_id)
      
      if (companyIds.length === 0) {
        return new Response(
          JSON.stringify({ companies: [] }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        )
      }

      const { data: companies, error: companiesError } = await supabaseClient
        .from('companies')
        .select('*')
        .in('id', companyIds)
        .order('name')

      if (companiesError) {
        console.error('Companies error:', companiesError)
        throw companiesError
      }

      return new Response(
        JSON.stringify({ companies }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

  } catch (error) {
    console.error("Error in company-data function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
