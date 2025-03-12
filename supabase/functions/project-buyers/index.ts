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
      let query = serviceClient
        .from('project_buyers')
        .select('*')
      
      // Filter by project if provided
      if (projectId) {
        query = query.eq('project_id', projectId)
        
        // For company users, verify project belongs to user's company
        if (!isAdmin) {
          const { data: userProject, error: projectError } = await serviceClient
            .from('projects')
            .select('id, company_id')
            .eq('id', projectId)
            .single()
          
          if (projectError) {
            console.error('Project check error:', projectError)
            return new Response(
              JSON.stringify({ error: 'Project not found or you lack access' }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 403 
              }
            )
          }

          // Check if user belongs to project's company
          const { data: userCompanies, error: companyError } = await serviceClient
            .from('user_companies')
            .select('company_id')
            .eq('user_id', user.id)
            .eq('company_id', userProject.company_id)
          
          if (companyError || !userCompanies.length) {
            console.error('Company permission error:', companyError || 'No matching companies')
            return new Response(
              JSON.stringify({ error: 'You do not have permission to access this project' }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 403 
              }
            )
          }
        }
      } else if (!isAdmin) {
        const { data: userCompanies, error: companyError } = await serviceClient
          .from('user_companies')
          .select('company_id')
          .eq('user_id', user.id)
        
        if (companyError) {
          console.error('User companies error:', companyError)
          throw companyError
        }
        
        if (!userCompanies || !userCompanies.length) {
          console.log('User has no companies, returning empty result')
          return new Response(
            JSON.stringify({ buyers: [] }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200 
            }
          )
        }
        
        const companyIds = userCompanies.map(uc => uc.company_id)
        
        // Get project IDs that belong to user's companies
        const { data: companyProjects, error: projectsError } = await serviceClient
          .from('projects')
          .select('id')
          .in('company_id', companyIds)
        
        if (projectsError) {
          console.error('Company projects error:', projectsError)
          throw projectsError
        }
        
        if (!companyProjects || !companyProjects.length) {
          console.log('User companies have no projects, returning empty result')
          return new Response(
            JSON.stringify({ buyers: [] }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200 
            }
          )
        }
        
        const projectIds = companyProjects.map(p => p.id)
        query = query.in('project_id', projectIds)
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
      const { data: buyer, error: buyerError } = await serviceClient
        .from('project_buyers')
        .select('*, projects(*)')
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
      
      // For company users, verify they have access to this buyer's project
      if (!isAdmin) {
        const { data: userCompanies, error: companyError } = await serviceClient
          .from('user_companies')
          .select('company_id')
          .eq('user_id', user.id)
        
        if (companyError) {
          console.error('User companies error:', companyError)
          throw companyError
        }
        
        const companyIds = userCompanies.map(uc => uc.company_id)
        
        // Check if the buyer's project belongs to one of the user's companies
        const { data: projectCompany, error: projectError } = await serviceClient
          .from('projects')
          .select('company_id')
          .eq('id', buyer.project_id)
          .single()
        
        if (projectError) {
          console.error('Project company check error:', projectError)
          throw projectError
        }
        
        if (!companyIds.includes(projectCompany.company_id)) {
          return new Response(
            JSON.stringify({ error: 'You do not have permission to access this buyer' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 403 
            }
          )
        }
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
      
      // Check permission for this project
      if (!isAdmin) {
        // Verify user has access to this project's company
        const { data: project, error: projectError } = await serviceClient
          .from('projects')
          .select('company_id')
          .eq('id', projectId)
          .single()
        
        if (projectError) {
          console.error('Project fetch error:', projectError)
          throw projectError
        }
        
        const { data: userCompanies, error: companyError } = await serviceClient
          .from('user_companies')
          .select('company_id')
          .eq('user_id', user.id)
          .eq('company_id', project.company_id)
        
        if (companyError || !userCompanies.length) {
          return new Response(
            JSON.stringify({ error: 'You do not have permission to create buyers for this project' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 403 
            }
          )
        }
      }
      
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
      
      const { data: buyer, error: buyerError } = await serviceClient
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
      
      // First, get the buyer to check permissions
      const { data: buyer, error: buyerFetchError } = await serviceClient
        .from('project_buyers')
        .select('project_id')
        .eq('id', buyerId)
        .single()
      
      if (buyerFetchError) {
        console.error('Project buyer fetch error:', buyerFetchError)
        if (buyerFetchError.code === 'PGRST116') {
          return new Response(
            JSON.stringify({ error: 'Project buyer not found' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 404 
            }
          )
        }
        throw buyerFetchError
      }
      
      // For company users, verify they have access to this buyer's project
      if (!isAdmin) {
        const { data: project, error: projectError } = await serviceClient
          .from('projects')
          .select('company_id')
          .eq('id', buyer.project_id)
          .single()
        
        if (projectError) {
          console.error('Project fetch error:', projectError)
          throw projectError
        }
        
        const { data: userCompanies, error: companyError } = await serviceClient
          .from('user_companies')
          .select('company_id')
          .eq('user_id', user.id)
          .eq('company_id', project.company_id)
        
        if (companyError || !userCompanies.length) {
          return new Response(
            JSON.stringify({ error: 'You do not have permission to update this buyer' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 403 
            }
          )
        }
        
        // Company users can only update contract-related fields
        const allowedFields = ['contract_file_path', 'contract_file_name', 'contract_status'];
        const requestedFields = Object.keys(buyerData);
        
        for (const field of requestedFields) {
          if (!allowedFields.includes(field)) {
            return new Response(
              JSON.stringify({ error: `Company users cannot update the "${field}" field` }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 403 
              }
            )
          }
        }
      }
      
      // Update the buyer record
      // The contract_status will be automatically updated to 'a_analisar'
      // by the database trigger when a contract is uploaded
      const { data: updatedBuyer, error: buyerError } = await serviceClient
        .from('project_buyers')
        .update(buyerData)
        .eq('id', buyerId)
        .select()
        .single()
      
      if (buyerError) {
        console.error('Project buyer update error:', buyerError)
        throw buyerError
      }

      return new Response(
        JSON.stringify({ buyer: updatedBuyer }),
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
