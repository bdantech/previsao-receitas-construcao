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
      throw new Error('Missing environment variables')
    }

    // Get authorization header
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

    console.log('Project receivables request:', method, endpoint, params)

    // Initialize Supabase client with user's auth token
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

    // Get all receivables for the user's projects
    if (endpoint === 'receivables' && method === 'GET') {
      let query = supabaseClient
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
      
      // If not admin, the RLS policies will restrict to only the user's company projects
      
      const { data: receivables, error: receivablesError } = await query
        .order('due_date', { ascending: true })
      
      if (receivablesError) {
        console.error('Receivables error:', receivablesError)
        throw receivablesError
      }

      return new Response(
        JSON.stringify({ receivables }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }
    
    // Create a new receivable
    if (endpoint === 'receivables' && method === 'POST') {
      console.log('Creating receivable with data:', params)
      
      const { projectId, buyerCpf, amount, dueDate, description } = params
      
      if (!projectId || !buyerCpf || !amount || !dueDate) {
        return new Response(
          JSON.stringify({ error: 'Required fields: projectId, buyerCpf, amount, dueDate' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }

      // If not admin, verify user belongs to company that owns the project
      if (!isAdmin) {
        const { data: projectCompany, error: projectError } = await supabaseClient
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

        const { data: userCompany, error: userCompanyError } = await supabaseClient
          .from('user_companies')
          .select('company_id')
          .eq('user_id', user.id)
          .eq('company_id', projectCompany.company_id)
          .single()

        if (userCompanyError) {
          console.error('User company verification error:', userCompanyError)
          return new Response(
            JSON.stringify({ error: 'You can only create receivables for your company projects' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 403 
            }
          )
        }
      }
      
      // Check buyer status to determine initial receivable status
      const { data: buyerData, error: buyerError } = await supabaseClient
        .from('project_buyers')
        .select('buyer_status')
        .eq('project_id', projectId)
        .eq('cpf', buyerCpf)
        .single()
      
      let initialStatus = 'enviado'
      
      if (!buyerError && buyerData) {
        if (buyerData.buyer_status === 'aprovado') {
          initialStatus = 'elegivel_para_antecipacao'
        } else if (buyerData.buyer_status === 'reprovado') {
          initialStatus = 'reprovado'
        }
      }
      
      // Create the receivable
      const { data: receivable, error: createError } = await supabaseClient
        .from('receivables')
        .insert({
          project_id: projectId,
          buyer_cpf: buyerCpf,
          amount,
          due_date: dueDate,
          description: description || null,
          status: initialStatus,
          created_by: user.id
        })
        .select()
        .single()
      
      if (createError) {
        console.error('Receivable creation error:', createError)
        throw createError
      }

      return new Response(
        JSON.stringify({ receivable }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 201 
        }
      )
    }
    
    // Get a single receivable
    if (endpoint && endpoint.startsWith('receivables/') && method === 'GET') {
      const receivableId = endpoint.split('/')[1]
      
      const { data: receivable, error: receivableError } = await supabaseClient
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
      
      if (receivableError) {
        console.error('Receivable fetch error:', receivableError)
        if (receivableError.code === 'PGRST116') {
          return new Response(
            JSON.stringify({ error: 'Receivable not found or you lack access' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 404 
            }
          )
        }
        throw receivableError
      }

      return new Response(
        JSON.stringify({ receivable }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }
    
    // Update receivable endpoint (future use for status changes)
    if (endpoint && endpoint.startsWith('receivables/') && method === 'PUT') {
      const receivableId = endpoint.split('/')[1]
      
      const { status, description } = params
      const updates: any = {}
      
      if (status !== undefined) updates.status = status
      if (description !== undefined) updates.description = description
      
      const { data: receivable, error: updateError } = await supabaseClient
        .from('receivables')
        .update(updates)
        .eq('id', receivableId)
        .select()
        .single()
      
      if (updateError) {
        console.error('Receivable update error:', updateError)
        if (updateError.code === 'PGRST116') {
          return new Response(
            JSON.stringify({ error: 'Receivable not found or you lack access' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 404 
            }
          )
        }
        throw updateError
      }

      return new Response(
        JSON.stringify({ receivable }),
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
    console.error("Error in project-receivables function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
