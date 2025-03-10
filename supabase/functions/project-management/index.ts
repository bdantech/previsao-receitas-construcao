
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

// CORS configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
}

serve(async (req) => {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get Supabase environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables')
    }

    // Extract the request path and method
    const url = new URL(req.url)
    const path = url.pathname.split('/').filter(Boolean)
    
    // The last segment of the path is the endpoint
    const endpoint = path[path.length - 1]

    // Initialize Supabase client with the user's token
    const authHeader = req.headers.get('Authorization')
    const supabase = createClient(
      supabaseUrl,
      supabaseKey,
      {
        global: {
          headers: authHeader ? { Authorization: authHeader } : {},
        },
      }
    )

    // Initialize admin Supabase client (only used when necessary)
    const adminSupabase = supabaseServiceKey ? 
      createClient(supabaseUrl, supabaseServiceKey) : 
      null

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    // Get user role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      return new Response(
        JSON.stringify({ error: 'Could not verify user role' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    const isAdmin = profile.role === 'admin'

    // Handle GET request for user's company
    if (req.method === 'GET' && endpoint === 'user-company') {
      // Get the user's company
      const { data: userCompany, error: companyError } = await supabase
        .from('user_companies')
        .select('company_id')
        .eq('user_id', user.id)
        .single()
      
      if (companyError) {
        console.error('Error fetching user company:', companyError);
        
        // If not found, return 404
        if (companyError.code === 'PGRST116') {
          return new Response(
            JSON.stringify({ error: 'User not associated with any company' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 404 
            }
          )
        }
        
        return new Response(
          JSON.stringify({ error: companyError.message }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }
      
      return new Response(
        JSON.stringify({ companyId: userCompany.company_id }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Handle GET requests (list projects with filtering)
    if (req.method === 'GET' && endpoint === 'projects') {
      const queryParams = url.searchParams
      const name = queryParams.get('name')
      const status = queryParams.get('status')
      
      // Start building query
      let query = supabase.from('projects')
        .select('*, companies(name)')
        .order('name')
      
      // Apply filters if provided
      if (name) {
        query = query.ilike('name', `%${name}%`)
      }
      
      if (status && (status === 'active' || status === 'inactive')) {
        query = query.eq('status', status)
      }
      
      // For non-admin users, only show projects from their companies
      if (!isAdmin) {
        // Get user's companies
        const { data: userCompanies, error: relationError } = await supabase
          .from('user_companies')
          .select('company_id')
          .eq('user_id', user.id)
        
        if (relationError) {
          return new Response(
            JSON.stringify({ error: 'Error fetching user companies' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          )
        }
        
        if (userCompanies.length === 0) {
          // No companies associated with the user
          return new Response(
            JSON.stringify({ projects: [] }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200 
            }
          )
        }
        
        const companyIds = userCompanies.map(uc => uc.company_id)
        query = query.in('company_id', companyIds)
      }
      
      // Execute the query
      const { data: projects, error: projectsError } = await query
      
      if (projectsError) {
        return new Response(
          JSON.stringify({ error: projectsError.message }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }
      
      return new Response(
        JSON.stringify({ projects }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }
    
    // Handle POST requests (create project)
    if (req.method === 'POST' && endpoint === 'projects') {
      // Parse the request body
      const requestData = await req.json()
      const { name, cnpj, company_id, initial_date, end_date } = requestData
      
      // Validate required fields
      if (!name || !cnpj || !company_id || !initial_date) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }
      
      // If not admin, verify user belongs to the company
      if (!isAdmin) {
        const { data: userCompany, error: relationError } = await supabase
          .from('user_companies')
          .select('*')
          .eq('user_id', user.id)
          .eq('company_id', company_id)
          .maybeSingle()
        
        if (relationError || !userCompany) {
          return new Response(
            JSON.stringify({ error: 'You do not have permission to create projects for this company' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 403 
            }
          )
        }
      }
      
      // Check if a project with this CNPJ already exists
      const { data: existingProject, error: checkError } = await supabase
        .from('projects')
        .select('id')
        .eq('cnpj', cnpj)
        .maybeSingle()
      
      if (checkError) {
        return new Response(
          JSON.stringify({ error: 'Error checking for existing project' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        )
      }
      
      if (existingProject) {
        return new Response(
          JSON.stringify({ error: 'A project with this CNPJ already exists' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }
      
      // Create the new project
      const { data: newProject, error: createError } = await supabase
        .from('projects')
        .insert({
          name,
          cnpj,
          company_id,
          initial_date,
          end_date: end_date || null,
          status: 'active' // Default status
        })
        .select()
        .single()
      
      if (createError) {
        return new Response(
          JSON.stringify({ error: createError.message }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }
      
      return new Response(
        JSON.stringify({ project: newProject }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 201 
        }
      )
    }
    
    // Handle PUT requests (update project)
    if (req.method === 'PUT' && path.length > 1) {
      const projectId = path[path.length - 1]
      
      // Get the project to update
      const { data: existingProject, error: getError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle()
      
      if (getError || !existingProject) {
        return new Response(
          JSON.stringify({ error: 'Project not found' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404 
          }
        )
      }
      
      // If not admin, verify user belongs to the project's company
      if (!isAdmin) {
        const { data: userCompany, error: relationError } = await supabase
          .from('user_companies')
          .select('*')
          .eq('user_id', user.id)
          .eq('company_id', existingProject.company_id)
          .maybeSingle()
        
        if (relationError || !userCompany) {
          return new Response(
            JSON.stringify({ error: 'You do not have permission to update this project' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 403 
            }
          )
        }
      }
      
      // Parse request body
      const requestData = await req.json()
      
      // Create an update object
      const updateData: any = {}
      
      // For company users, only allow updating status, name, and end_date
      if (!isAdmin) {
        if ('name' in requestData) updateData.name = requestData.name
        if ('status' in requestData && 
            (requestData.status === 'active' || requestData.status === 'inactive')) {
          updateData.status = requestData.status
        }
        if ('end_date' in requestData) updateData.end_date = requestData.end_date
      } else {
        // Admins can update any field except CNPJ
        Object.keys(requestData).forEach(key => {
          if (key !== 'cnpj' && key !== 'id') { // Never allow changing CNPJ or ID
            updateData[key] = requestData[key]
          }
        })
      }
      
      // Update the project
      const { data: updatedProject, error: updateError } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', projectId)
        .select()
        .single()
      
      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }
      
      return new Response(
        JSON.stringify({ project: updatedProject }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }
    
    // Handle GET single project
    if (req.method === 'GET' && path.length > 1) {
      const projectId = path[path.length - 1]
      
      // Get the project
      const { data: project, error: getError } = await supabase
        .from('projects')
        .select('*, companies(name)')
        .eq('id', projectId)
        .single()
      
      if (getError) {
        return new Response(
          JSON.stringify({ error: 'Project not found' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404 
          }
        )
      }
      
      // For non-admin users, verify they belong to the project's company
      if (!isAdmin) {
        const { data: userCompany, error: relationError } = await supabase
          .from('user_companies')
          .select('*')
          .eq('user_id', user.id)
          .eq('company_id', project.company_id)
          .maybeSingle()
        
        if (relationError || !userCompany) {
          return new Response(
            JSON.stringify({ error: 'You do not have permission to view this project' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 403 
            }
          )
        }
      }
      
      return new Response(
        JSON.stringify({ project }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }
    
    // If we get here, the endpoint was not found
    return new Response(
      JSON.stringify({ error: 'Endpoint not found' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404 
      }
    )
    
  } catch (error) {
    console.error('Error in project-management function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
