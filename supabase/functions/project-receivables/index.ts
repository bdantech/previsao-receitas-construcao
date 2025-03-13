import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

// CORS configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey || !supabaseServiceKey) {
      console.error('Missing environment variables')
      throw new Error('Missing environment variables')
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('No Authorization header')
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

    console.log('Project receivables request:', {
      method,
      endpoint,
      params,
      hasAuth: !!authHeader
    })

    // Initialize service role client for reliable database access
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey)

    // Initialize user client for authentication
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

    // Authenticate user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    
    if (authError || !user) {
      console.error('Auth error:', authError)
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
    const { data: profile, error: profileError } = await adminSupabase
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

    // Get all receivables for the user's projects
    if (endpoint === 'receivables' && method === 'GET') {
      try {
        let query = adminSupabase
          .from('receivables')
          .select(`
            id,
            project_id,
            buyer_name,
            buyer_cpf,
            amount,
            due_date,
            description,
            status,
            created_at,
            updated_at,
            projects:project_id (
              name
            )
          `)
        
        // Apply filters if provided
        if (params.projectId) {
          query = query.eq('project_id', params.projectId)
        }
        
        if (params.status) {
          query = query.eq('status', params.status)
        }
        
        if (params.buyerCpf) {
          query = query.ilike('buyer_cpf', `%${params.buyerCpf}%`)
        }
        
        // If not admin, restrict to user's company projects
        if (!isAdmin) {
          // Get user's company
          const { data: userCompany, error: companyError } = await adminSupabase
            .from('user_companies')
            .select('company_id')
            .eq('user_id', user.id)
            .single()

          if (companyError) {
            console.error('Error getting user company:', companyError)
            throw new Error('Failed to verify user company')
          }

          // Get company's projects
          const { data: projects, error: projectsError } = await adminSupabase
            .from('projects')
            .select('id')
            .eq('company_id', userCompany.company_id)

          if (projectsError) {
            console.error('Error getting company projects:', projectsError)
            throw new Error('Failed to verify company projects')
          }

          const projectIds = projects.map(p => p.id)
          query = query.in('project_id', projectIds)
        }
        
        const { data: receivables, error: receivablesError } = await query
          .order('due_date', { ascending: true })
        
        if (receivablesError) {
          console.error('Receivables error:', receivablesError)
          throw receivablesError
        }

        console.log(`Found ${receivables?.length || 0} receivables`)
        return new Response(
          JSON.stringify({ receivables }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        )
      } catch (error) {
        console.error('Error in GET receivables:', error)
        return new Response(
          JSON.stringify({ error: error.message || 'Failed to fetch receivables' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        )
      }
    }
    
    // Create a new receivable
    if (endpoint === 'receivables' && method === 'POST') {
      try {
        console.log('Creating receivable with data:', params)
        
        const { projectId, buyerName, buyerCpf, amount, dueDate, description } = params
        
        if (!projectId || !buyerName || !buyerCpf || !amount || !dueDate) {
          return new Response(
            JSON.stringify({ error: 'Required fields: projectId, buyerName, buyerCpf, amount, dueDate' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          )
        }

        // If not admin, verify user belongs to company that owns the project
        if (!isAdmin) {
          // Get project's company
          const { data: projectData, error: projectError } = await adminSupabase
            .from('projects')
            .select('company_id')
            .eq('id', projectId)
            .single()

          if (projectError) {
            console.error('Project verification error:', projectError)
            return new Response(
              JSON.stringify({ error: 'Project not found or you lack access' }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 403 
              }
            )
          }

          // Get user's company
          const { data: userCompanies, error: userCompanyError } = await adminSupabase
            .from('user_companies')
            .select('company_id')
            .eq('user_id', user.id)

          if (userCompanyError) {
            console.error('User company verification error:', userCompanyError)
            return new Response(
              JSON.stringify({ error: 'Failed to verify user company access' }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500 
              }
            )
          }

          // Check if user belongs to the project's company
          const hasAccess = userCompanies.some(uc => uc.company_id === projectData.company_id)
          
          if (!hasAccess) {
            console.error('User does not have access to this project')
            return new Response(
              JSON.stringify({ error: 'You can only create receivables for your company projects' }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 403 
              }
            )
          }
        }
        
        // Check if we already have a buyer with this CPF for this project
        const { data: existingBuyer, error: buyerCheckError } = await adminSupabase
          .from('project_buyers')
          .select('id, full_name, buyer_status')
          .eq('project_id', projectId)
          .eq('cpf', buyerCpf)
          .maybeSingle()
        
        if (buyerCheckError) {
          console.error('Buyer check error:', buyerCheckError)
          throw buyerCheckError
        }
        
        // If buyer doesn't exist, create a new one
        if (!existingBuyer) {
          console.log('No existing buyer found with CPF', buyerCpf, 'Creating new buyer record')
          
          const { data: newBuyer, error: createBuyerError } = await adminSupabase
            .from('project_buyers')
            .insert({
              project_id: projectId,
              full_name: buyerName,
              cpf: buyerCpf,
              contract_status: 'a_enviar',
              credit_analysis_status: 'a_analisar',
              buyer_status: 'a_analisar'
            })
            .select()
            .single()
          
          if (createBuyerError) {
            console.error('Error creating buyer:', createBuyerError)
            throw createBuyerError
          }
          
          console.log('New buyer created:', newBuyer)
        } else {
          console.log('Existing buyer found:', existingBuyer)
        }
        
        // Determine initial status based on buyer status (either from existing or just created)
        let initialStatus = 'enviado'
        if (existingBuyer) {
          if (existingBuyer.buyer_status === 'aprovado') {
            initialStatus = 'elegivel_para_antecipacao'
          } else if (existingBuyer.buyer_status === 'reprovado') {
            initialStatus = 'reprovado'
          }
        }

        // Create the receivable
        const { data: receivable, error: createError } = await adminSupabase
          .from('receivables')
          .insert({
            project_id: projectId,
            buyer_name: buyerName,
            buyer_cpf: buyerCpf,
            amount,
            due_date: dueDate,
            description,
            status: initialStatus,
            created_by: user.id
          })
          .select()
          .single()

        if (createError) {
          console.error('Create receivable error:', createError)
          throw createError
        }

        console.log('Created receivable:', receivable)
        return new Response(
          JSON.stringify({ receivable }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 201 
          }
        )
      } catch (error) {
        console.error('Error in POST receivables:', error)
        return new Response(
          JSON.stringify({ error: error.message || 'Failed to create receivable' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        )
      }
    }

    // GET a single receivable
    if (endpoint.startsWith('receivables/') && method === 'GET') {
      try {
        const receivableId = endpoint.split('/')[1]
        
        if (!receivableId) {
          return new Response(
            JSON.stringify({ error: 'Receivable ID is required' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          )
        }
        
        let query = adminSupabase
          .from('receivables')
          .select(`
            id,
            project_id,
            buyer_cpf,
            amount,
            due_date,
            description,
            status,
            created_at,
            updated_at,
            projects:project_id (
              name,
              company_id
            )
          `)
          .eq('id', receivableId)
          .single()
        
        const { data: receivable, error: receivableError } = await query
        
        if (receivableError) {
          console.error('Receivable error:', receivableError)
          throw receivableError
        }
        
        // If not admin, verify user has access to this receivable
        if (!isAdmin) {
          // Get user's company
          const { data: userCompany, error: companyError } = await adminSupabase
            .from('user_companies')
            .select('company_id')
            .eq('user_id', user.id)
            .single()

          if (companyError) {
            console.error('Error getting user company:', companyError)
            throw new Error('Failed to verify user company')
          }
          
          // Get the project's company
          const projectCompanyId = receivable.projects?.company_id
          
          if (userCompany.company_id !== projectCompanyId) {
            return new Response(
              JSON.stringify({ error: 'You do not have access to this receivable' }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 403 
              }
            )
          }
        }
        
        return new Response(
          JSON.stringify({ receivable }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        )
      } catch (error) {
        console.error('Error in GET single receivable:', error)
        return new Response(
          JSON.stringify({ error: error.message || 'Failed to fetch receivable' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        )
      }
    }
    
    // Update a receivable
    if (endpoint.startsWith('receivables/') && method === 'PUT') {
      try {
        const receivableId = endpoint.split('/')[1]
        
        if (!receivableId) {
          return new Response(
            JSON.stringify({ error: 'Receivable ID is required' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          )
        }
        
        // Get the receivable first to check permissions
        const { data: receivable, error: getError } = await adminSupabase
          .from('receivables')
          .select(`
            id,
            project_id,
            projects:project_id (
              company_id
            )
          `)
          .eq('id', receivableId)
          .single()
        
        if (getError) {
          console.error('Error getting receivable:', getError)
          throw getError
        }
        
        // If not admin, verify user has access to this receivable
        if (!isAdmin) {
          // Get user's company
          const { data: userCompany, error: companyError } = await adminSupabase
            .from('user_companies')
            .select('company_id')
            .eq('user_id', user.id)
            .single()

          if (companyError) {
            console.error('Error getting user company:', companyError)
            throw new Error('Failed to verify user company')
          }
          
          // Get the project's company
          const projectCompanyId = receivable.projects?.company_id
          
          if (userCompany.company_id !== projectCompanyId) {
            return new Response(
              JSON.stringify({ error: 'You do not have access to this receivable' }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 403 
              }
            )
          }
        }
        
        // Prepare updates
        const updates: Record<string, any> = {}
        
        if (params.status) updates.status = params.status
        if (params.description !== undefined) updates.description = params.description
        
        // Update the receivable
        const { data: updatedReceivable, error: updateError } = await adminSupabase
          .from('receivables')
          .update(updates)
          .eq('id', receivableId)
          .select()
          .single()
        
        if (updateError) {
          console.error('Error updating receivable:', updateError)
          throw updateError
        }
        
        return new Response(
          JSON.stringify({ receivable: updatedReceivable }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        )
      } catch (error) {
        console.error('Error in PUT receivable:', error)
        return new Response(
          JSON.stringify({ error: error.message || 'Failed to update receivable' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        )
      }
    }

    // If we get here, the operation or method is not supported
    return new Response(
      JSON.stringify({ error: 'Operation not supported' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )

  } catch (error) {
    console.error('Error in project-receivables function:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
