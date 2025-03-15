
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

    // Initialize Supabase client with user's auth token for auth verification
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

    // Service client for operations that bypass RLS
    const serviceClient = createClient(
      supabaseUrl,
      supabaseServiceKey
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

    // Parse request
    const requestData = await req.json()
    const { action, ...data } = requestData

    // Handle different actions
    switch (action) {
      case 'calculateValorLiquido': {
        return await handleCalculateValorLiquido(supabaseClient, serviceClient, data, corsHeaders)
      }
      case 'getReceivablesForAnticipation': {
        return await handleGetReceivablesForAnticipation(supabaseClient, serviceClient, data, corsHeaders)
      }
      case 'createAnticipation': {
        return await handleCreateAnticipation(supabaseClient, serviceClient, data, corsHeaders, user.id)
      }
      case 'getAnticipations': {
        return await handleGetAnticipations(supabaseClient, data, corsHeaders)
      }
      case 'getAnticipationReceivables': {
        return await handleGetAnticipationReceivables(supabaseClient, data, corsHeaders)
      }
      case 'getAnticipationDetails': {
        return await handleGetAnticipationDetails(supabaseClient, data, corsHeaders)
      }
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
    }
  } catch (error) {
    console.error("Error in company-anticipations function:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

// Handler for calculating the valor liquido (anticipated amount after deductions)
async function handleCalculateValorLiquido(supabaseClient, serviceClient, data, corsHeaders) {
  const { receivableIds, companyId } = data

  if (!receivableIds || !Array.isArray(receivableIds) || receivableIds.length === 0) {
    return new Response(
      JSON.stringify({ error: 'At least one receivable ID is required' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }

  if (!companyId) {
    return new Response(
      JSON.stringify({ error: 'Company ID is required' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }

  try {
    // Use the SQL function to calculate the valor liquido
    // Fix: We're now explicitly specifying the parameter names to avoid ambiguity
    const { data: result, error } = await serviceClient.rpc(
      'calculate_anticipation_valor_liquido',
      {
        p_receivable_ids: receivableIds,
        p_company_id: companyId
      }
    )

    if (error) {
      console.error('Error calculating valor liquido:', error)
      throw error
    }

    // Get all the receivables to return complete data
    const { data: receivables, error: receivablesError } = await supabaseClient
      .from('receivables')
      .select(`
        id,
        amount,
        due_date,
        buyer_name,
        buyer_cpf,
        description
      `)
      .in('id', receivableIds)
      .eq('status', 'elegivel_para_antecipacao')

    if (receivablesError) {
      console.error('Error fetching receivables:', receivablesError)
      throw receivablesError
    }

    // Get the credit analysis for the company
    const { data: creditAnalysis, error: creditAnalysisError } = await supabaseClient
      .from('company_credit_analysis')
      .select(`
        interest_rate_180,
        interest_rate_360,
        interest_rate_720,
        interest_rate_long_term,
        fee_per_receivable
      `)
      .eq('company_id', companyId)
      .eq('status', 'Ativa')
      .single()

    if (creditAnalysisError) {
      console.error('Error fetching credit analysis:', creditAnalysisError)
      throw creditAnalysisError
    }

    // Calculate the total amount
    const valorTotal = receivables.reduce((total, rec) => total + Number(rec.amount), 0)

    return new Response(
      JSON.stringify({
        receivables,
        valorTotal,
        valorLiquido: result,
        quantidade: receivables.length,
        taxas: creditAnalysis
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error("Error calculating valor liquido:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
}

// Handler for fetching eligible receivables for anticipation
async function handleGetReceivablesForAnticipation(supabaseClient, serviceClient, data, corsHeaders) {
  const { projectId, status = 'elegivel_para_antecipacao', companyId } = data

  if (!companyId) {
    return new Response(
      JSON.stringify({ error: 'Company ID is required' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }

  // Get available receivables that are eligible for anticipation
  let query = supabaseClient
    .from('receivables')
    .select(`
      id,
      amount,
      due_date,
      buyer_name,
      buyer_cpf,
      description,
      project_id,
      projects:project_id (name)
    `)
    .eq('status', status)

  // If projectId is provided, filter by project
  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  // Execute the query
  const { data: receivables, error } = await query

  if (error) {
    console.error('Error fetching receivables:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }

  // Check if receivables are from projects belonging to the company
  const { data: projects, error: projectsError } = await supabaseClient
    .from('projects')
    .select('id')
    .eq('company_id', companyId)

  if (projectsError) {
    console.error('Error fetching projects:', projectsError)
    return new Response(
      JSON.stringify({ error: projectsError.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }

  // Filter receivables to only include those from the company's projects
  const projectIds = projects.map(p => p.id)
  const filteredReceivables = receivables.filter(r => projectIds.includes(r.project_id))

  return new Response(
    JSON.stringify({ receivables: filteredReceivables }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  )
}

// Handler for creating a new anticipation request
async function handleCreateAnticipation(supabaseClient, serviceClient, data, corsHeaders, userId) {
  const { 
    companyId, 
    projectId, 
    receivableIds, 
    valorTotal, 
    valorLiquido, 
    taxaJuros180,
    taxaJuros360,
    taxaJuros720,
    taxaJurosLongoPrazo,
    tarifaPorRecebivel
  } = data

  // Validate required fields
  if (!companyId || !projectId || !receivableIds || !valorTotal || !valorLiquido) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }

  if (!Array.isArray(receivableIds) || receivableIds.length === 0) {
    return new Response(
      JSON.stringify({ error: 'At least one receivable ID is required' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }

  // Start a transaction
  try {
    // Create the anticipation request
    const { data: anticipation, error: anticipationError } = await serviceClient
      .from('anticipation_requests')
      .insert({
        company_id: companyId,
        project_id: projectId,
        valor_total: valorTotal,
        valor_liquido: valorLiquido,
        quantidade_recebiveis: receivableIds.length,
        taxa_juros_180: taxaJuros180,
        taxa_juros_360: taxaJuros360,
        taxa_juros_720: taxaJuros720,
        taxa_juros_longo_prazo: taxaJurosLongoPrazo,
        tarifa_por_recebivel: tarifaPorRecebivel,
        status: 'Solicitada'
      })
      .select()
      .single()

    if (anticipationError) {
      console.error('Error creating anticipation:', anticipationError)
      throw anticipationError
    }

    // Create the links between anticipation and receivables
    const anticipationReceivables = receivableIds.map(receivableId => ({
      anticipation_id: anticipation.id,
      receivable_id: receivableId
    }))

    const { error: receivablesLinkError } = await serviceClient
      .from('anticipation_receivables')
      .insert(anticipationReceivables)

    if (receivablesLinkError) {
      console.error('Error linking receivables to anticipation:', receivablesLinkError)
      throw receivablesLinkError
    }

    // Update the status of the receivables to 'antecipado'
    const { error: updateReceivablesError } = await serviceClient
      .from('receivables')
      .update({ status: 'antecipado' })
      .in('id', receivableIds)

    if (updateReceivablesError) {
      console.error('Error updating receivables status:', updateReceivablesError)
      throw updateReceivablesError
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        anticipation 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error in anticipation creation:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
}

// Handler for getting all anticipations for a company
async function handleGetAnticipations(supabaseClient, data, corsHeaders) {
  const { companyId, status } = data

  if (!companyId) {
    return new Response(
      JSON.stringify({ error: 'Company ID is required' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }

  try {
    let query = supabaseClient
      .from('anticipation_requests')
      .select(`
        id,
        project_id,
        valor_total,
        valor_liquido,
        status,
        quantidade_recebiveis,
        created_at,
        updated_at,
        projects:project_id (name)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status)
    }

    const { data: anticipations, error } = await query

    if (error) {
      console.error('Error fetching anticipations:', error)
      throw error
    }

    return new Response(
      JSON.stringify({ anticipations }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error fetching anticipations:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
}

// Handler for getting all receivables associated with an anticipation
async function handleGetAnticipationReceivables(supabaseClient, data, corsHeaders) {
  const { anticipationId } = data

  if (!anticipationId) {
    return new Response(
      JSON.stringify({ error: 'Anticipation ID is required' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }

  try {
    const { data: anticipationReceivables, error } = await supabaseClient
      .from('anticipation_receivables')
      .select(`
        id,
        anticipation_id,
        receivable_id,
        receivables:receivable_id (
          id,
          buyer_name,
          buyer_cpf,
          amount,
          due_date,
          description,
          status
        )
      `)
      .eq('anticipation_id', anticipationId)

    if (error) {
      console.error('Error fetching anticipation receivables:', error)
      throw error
    }

    // Extract the receivables data for a cleaner response
    const receivables = anticipationReceivables.map(ar => ar.receivables)

    return new Response(
      JSON.stringify({ receivables }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error fetching anticipation receivables:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
}

// Handler for getting detailed information about a specific anticipation
async function handleGetAnticipationDetails(supabaseClient, data, corsHeaders) {
  const { anticipationId } = data

  if (!anticipationId) {
    return new Response(
      JSON.stringify({ error: 'Anticipation ID is required' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }

  try {
    // Get anticipation details
    const { data: anticipation, error: anticipationError } = await supabaseClient
      .from('anticipation_requests')
      .select(`
        *,
        projects:project_id (
          name,
          cnpj
        ),
        companies:company_id (
          name,
          cnpj
        )
      `)
      .eq('id', anticipationId)
      .single()

    if (anticipationError) {
      console.error('Error fetching anticipation details:', anticipationError)
      throw anticipationError
    }

    // Get associated receivables
    const { data: receivablesResponse, error: receivablesError } = await handleGetAnticipationReceivables(
      supabaseClient, 
      { anticipationId }, 
      {}
    ).then(res => res.json())

    if (receivablesError) {
      console.error('Error fetching anticipation receivables:', receivablesError)
      throw receivablesError
    }

    return new Response(
      JSON.stringify({ 
        anticipation, 
        receivables: receivablesResponse.receivables 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error fetching anticipation details:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
}
