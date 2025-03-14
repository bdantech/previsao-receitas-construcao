
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get supabase client with auth context from request
    const authorization = req.headers.get('Authorization')
    if (!authorization) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    })

    // Verify the user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get the request data
    const requestData = await req.json()
    const { action, companyId } = requestData

    console.log(`Company credit function - Action: ${action}, User: ${user.id}`)

    // If no company ID is provided, find the companies associated with the user
    let userCompanies = []
    if (!companyId) {
      const { data: companies, error: companiesError } = await supabase
        .from('user_companies')
        .select('company_id')
        .eq('user_id', user.id)
      
      if (companiesError) {
        return new Response(JSON.stringify({ error: 'Error fetching user companies' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      userCompanies = companies.map(comp => comp.company_id)
      
      if (userCompanies.length === 0) {
        return new Response(JSON.stringify({ error: 'No companies associated with this user' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    let result
    let error

    switch (action) {
      case 'list':
        // List credit analyses for companies the user has access to
        if (companyId) {
          // Verify user has access to this company
          const { count, error: accessError } = await supabase
            .from('user_companies')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('company_id', companyId)
          
          if (accessError || count === 0) {
            return new Response(JSON.stringify({ error: 'Unauthorized access to this company' }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }

          const { data, error: listError } = await supabase
            .from('company_credit_analysis')
            .select(`
              *,
              companies:company_id (name, cnpj)
            `)
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })
          
          result = data
          error = listError
        } else {
          // Get analyses for all user's companies
          const { data, error: listError } = await supabase
            .from('company_credit_analysis')
            .select(`
              *,
              companies:company_id (name, cnpj)
            `)
            .in('company_id', userCompanies)
            .order('created_at', { ascending: false })
          
          result = data
          error = listError
        }
        break

      case 'get_active':
        // Get only the active credit analysis for a company
        if (companyId) {
          // Verify user has access to this company
          const { count, error: accessError } = await supabase
            .from('user_companies')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('company_id', companyId)
          
          if (accessError || count === 0) {
            return new Response(JSON.stringify({ error: 'Unauthorized access to this company' }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }

          const { data, error: getError } = await supabase
            .from('company_credit_analysis')
            .select(`
              *,
              companies:company_id (name, cnpj)
            `)
            .eq('company_id', companyId)
            .eq('status', 'Ativa')
            .single()
          
          result = data
          error = getError
        } else {
          // For all user's companies, get the active analyses
          const { data, error: getError } = await supabase
            .from('company_credit_analysis')
            .select(`
              *,
              companies:company_id (name, cnpj)
            `)
            .in('company_id', userCompanies)
            .eq('status', 'Ativa')
          
          result = data
          error = getError
        }
        break

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    if (error) {
      console.error(`Error in ${action} operation:`, error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
