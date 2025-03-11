
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
        JSON.stringify({ error: 'Authentication required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    // Parse request body
    const requestData = await req.json()
    const { action, projectId, buyerId, buyerData } = requestData

    console.log('Project buyers request:', action, projectId, buyerId)

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

    // Service client for operations that need admin privileges (if needed)
    const serviceClient = createClient(
      supabaseUrl,
      supabaseServiceKey
    )

    // Autenticação e informações do usuário
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    
    if (authError) {
      console.error('Auth error:', authError)
      throw authError
    }
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    console.log('User authenticated:', user.id)

    // Get user profile to determine role
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Profile error:', profileError)
      throw profileError
    }

    const isAdmin = profile.role === 'admin'
    console.log('User role:', profile.role)

    // GET project buyers (list)
    if (action === 'list') {
      let query = supabaseClient
        .from('project_buyers')
        .select('*')
      
      // Filter by project if provided
      if (projectId) {
        query = query.eq('project_id', projectId)
      }
      
      const { data: buyers, error: buyersError } = await query.order('created_at', { ascending: false })
      
      if (buyersError) {
        console.error('Project buyers error:', buyersError)
        throw buyersError
      }

      return new Response(
        JSON.stringify({ buyers }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }
    
    // GET single project buyer
    if (action === 'get' && buyerId) {
      const { data: buyer, error: buyerError } = await supabaseClient
        .from('project_buyers')
        .select('*')
        .eq('id', buyerId)
        .single()
      
      if (buyerError) {
        console.error('Project buyer fetch error:', buyerError)
        if (buyerError.code === 'PGRST116') {
          return new Response(
            JSON.stringify({ error: 'Project buyer not found or you lack access' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 404 
            }
          )
        }
        throw buyerError
      }

      return new Response(
        JSON.stringify({ buyer }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }
    
    // CREATE project buyer
    if (action === 'create' && projectId && buyerData) {
      console.log('Creating project buyer with data:', buyerData)
      
      const { full_name, cpf, contract_file_path, contract_file_name } = buyerData
      
      if (!full_name || !cpf) {
        return new Response(
          JSON.stringify({ error: 'Required fields: full_name, cpf' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }
      
      const { data: buyer, error: buyerError } = await supabaseClient
        .from('project_buyers')
        .insert({
          project_id: projectId,
          full_name,
          cpf,
          contract_file_path: contract_file_path || '',
          contract_file_name: contract_file_name || ''
        })
        .select()
        .single()
      
      if (buyerError) {
        console.error('Project buyer creation error:', buyerError)
        throw buyerError
      }

      return new Response(
        JSON.stringify({ buyer }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 201 
        }
      )
    }
    
    // UPDATE project buyer 
    if (action === 'update' && buyerId && buyerData) {
      console.log('Updating project buyer with data:', buyerData)
      
      const { data: buyer, error: buyerError } = await supabaseClient
        .from('project_buyers')
        .update(buyerData)
        .eq('id', buyerId)
        .select()
        .single()
      
      if (buyerError) {
        console.error('Project buyer update error:', buyerError)
        if (buyerError.code === 'PGRST116') {
          return new Response(
            JSON.stringify({ error: 'Project buyer not found or you lack access' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 404 
            }
          )
        }
        throw buyerError
      }

      return new Response(
        JSON.stringify({ buyer }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }
    
    return new Response(
      JSON.stringify({ error: 'Invalid action or missing parameters' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )

  } catch (error) {
    console.error("Error in project-buyers function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
