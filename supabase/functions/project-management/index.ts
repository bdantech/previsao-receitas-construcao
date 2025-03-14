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
    const { method, endpoint, ...params } = requestData

    console.log('Project management request:', method, endpoint, params)

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

    // Service client for operations that need admin privileges
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

    // Get user company endpoint
    if (endpoint === 'user-company') {
      console.log('Fetching user company')
      const { data: userCompany, error: userCompanyError } = await supabaseClient
        .from('user_companies')
        .select('company_id')
        .eq('user_id', user.id)
        .single()

      if (userCompanyError) {
        if (userCompanyError.code === 'PGRST116') {
          // No company found, not an error for this endpoint
          return new Response(
            JSON.stringify({ companyId: null }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200 
            }
          )
        }
        console.error('User company error:', userCompanyError)
        throw userCompanyError
      }

      console.log('User company found:', userCompany)
      return new Response(
        JSON.stringify({ companyId: userCompany.company_id }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

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

    // Get projects endpoint
    if (endpoint === 'projects' && method === 'GET') {
      let query = supabaseClient
        .from('projects')
        .select(`
          *,
          companies:company_id (
            id,
            name
          )
        `)
      
      // Apply filters if provided
      if (params.name) {
        query = query.ilike('name', `%${params.name}%`)
      }
      
      if (params.status) {
        query = query.eq('status', params.status)
      }
      
      // If not admin, filter by user's company
      if (!isAdmin) {
        const { data: userCompany, error: userCompanyError } = await supabaseClient
          .from('user_companies')
          .select('company_id')
          .eq('user_id', user.id)
          .single()

        if (userCompanyError) {
          console.error('User company error:', userCompanyError)
          throw userCompanyError
        }
        
        query = query.eq('company_id', userCompany.company_id)
      }
      
      const { data: projects, error: projectsError } = await query.order('created_at', { ascending: false })
      
      if (projectsError) {
        console.error('Projects error:', projectsError)
        throw projectsError
      }

      return new Response(
        JSON.stringify({ projects }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }
    
    // Create project endpoint
    if (endpoint === 'projects' && method === 'POST') {
      console.log('Creating project with data:', params)
      
      const { name, cnpj, company_id, initial_date, end_date } = params
      
      if (!name || !cnpj || !company_id || !initial_date) {
        return new Response(
          JSON.stringify({ error: 'Required fields: name, cnpj, company_id, initial_date' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }
      
      // If not admin, verify user belongs to company
      if (!isAdmin) {
        const { data: userCompany, error: userCompanyError } = await supabaseClient
          .from('user_companies')
          .select('company_id')
          .eq('user_id', user.id)
          .eq('company_id', company_id)
          .single()

        if (userCompanyError) {
          console.error('User company verification error:', userCompanyError)
          return new Response(
            JSON.stringify({ error: 'You can only create projects for your company' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 403 
            }
          )
        }
      }
      
      const { data: project, error: projectError } = await supabaseClient
        .from('projects')
        .insert({
          name,
          cnpj,
          company_id,
          initial_date,
          end_date: end_date || null
        })
        .select()
        .single()
      
      if (projectError) {
        console.error('Project creation error:', projectError)
        throw projectError
      }

      return new Response(
        JSON.stringify({ project }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 201 
        }
      )
    }
    
    // Get single project endpoint
    if (endpoint && endpoint.startsWith('projects/') && method === 'GET') {
      const projectId = endpoint.split('/')[1]
      
      let query = supabaseClient
        .from('projects')
        .select(`
          *,
          companies:company_id (
            id,
            name
          )
        `)
        .eq('id', projectId)
      
      // If not admin, verify user has access to this project
      if (!isAdmin) {
        const { data: userCompany, error: userCompanyError } = await supabaseClient
          .from('user_companies')
          .select('company_id')
          .eq('user_id', user.id)
          .single()

        if (userCompanyError) {
          console.error('User company error:', userCompanyError)
          throw userCompanyError
        }
        
        query = query.eq('company_id', userCompany.company_id)
      }
      
      const { data: project, error: projectError } = await query.single()
      
      if (projectError) {
        console.error('Project fetch error:', projectError)
        if (projectError.code === 'PGRST116') {
          return new Response(
            JSON.stringify({ error: 'Project not found or you lack access' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 404 
            }
          )
        }
        throw projectError
      }

      return new Response(
        JSON.stringify({ project }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }
    
    // Update project endpoint
    if (endpoint && method === 'PUT') {
      const projectId = endpoint.startsWith('projects/') 
        ? endpoint.split('/')[1]  // Handle case where "projects/" is still included for backward compatibility
        : endpoint;               // Handle case where only the ID is provided
      
      console.log('Updating project with ID:', projectId);
      
      const { name, status, end_date } = params
      const updates = {}
      
      if (name !== undefined) updates.name = name
      if (status !== undefined) updates.status = status
      if (end_date !== undefined) updates.end_date = end_date
      
      let query = supabaseClient
        .from('projects')
        .update(updates)
        .eq('id', projectId)
      
      // If not admin, verify user has access to this project
      if (!isAdmin) {
        const { data: userCompany, error: userCompanyError } = await supabaseClient
          .from('user_companies')
          .select('company_id')
          .eq('user_id', user.id)
          .single()

        if (userCompanyError) {
          console.error('User company error:', userCompanyError)
          throw userCompanyError
        }
        
        query = query.eq('company_id', userCompany.company_id)
      }
      
      const { data: project, error: projectError } = await query
        .select()
        .single()
      
      if (projectError) {
        console.error('Project update error:', projectError)
        if (projectError.code === 'PGRST116') {
          return new Response(
            JSON.stringify({ error: 'Project not found or you lack access' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 404 
            }
          )
        }
        throw projectError
      }

      return new Response(
        JSON.stringify({ project }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }
    
    return new Response(
      JSON.stringify({ error: 'Endpoint not found' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404 
      }
    )

  } catch (error) {
    console.error("Error in project-management function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
