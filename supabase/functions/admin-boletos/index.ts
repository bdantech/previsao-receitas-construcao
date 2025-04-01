
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

    // Service client for admin operations (bypasses RLS)
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

    // Verify user is an admin
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Profile error:', profileError)
      throw profileError
    }

    if (profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403 
        }
      )
    }

    console.log('Admin access verified')

    // Parse request
    const { action, data } = await req.json()
    console.log(`Received action: ${action}`, data)

    // Handle different actions
    switch (action) {
      case 'getBoletos': {
        const { filters } = data || {}
        return await handleGetBoletos(serviceClient, filters, corsHeaders)
      }
      
      case 'createBoletos': {
        const { billingReceivableIds } = data
        return await handleCreateBoletos(serviceClient, billingReceivableIds, corsHeaders)
      }

      case 'updateBoleto': {
        const { boletoId, updateData } = data
        return await handleUpdateBoleto(serviceClient, boletoId, updateData, corsHeaders)
      }

      case 'deleteBoleto': {
        const { boletoId } = data
        return await handleDeleteBoleto(serviceClient, boletoId, corsHeaders)
      }

      case 'getAvailableBillingReceivables': {
        return await handleGetAvailableBillingReceivables(serviceClient, corsHeaders)
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
    console.error("Error in admin-boletos function:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

async function handleGetBoletos(serviceClient, filters, corsHeaders) {
  console.log('Getting boletos with filters:', filters)
  
  let query = serviceClient
    .from('boletos')
    .select(`
      id,
      billing_receivable_id,
      valor_face,
      valor_boleto,
      percentual_atualizacao,
      data_vencimento,
      data_emissao,
      nosso_numero,
      linha_digitavel,
      arquivo_boleto_path,
      arquivo_boleto_name,
      status_emissao,
      status_pagamento,
      payer_tax_id,
      project_tax_id,
      project_id,
      company_id,
      created_at,
      updated_at,
      index_id,
      indexes:index_id (
        id,
        name
      ),
      projects:project_id (
        id,
        name
      ),
      companies:company_id (
        id,
        name
      ),
      billing_receivables:billing_receivable_id (
        id,
        receivable_id,
        installment_id,
        nova_data_vencimento,
        receivables:receivable_id (
          id,
          amount,
          buyer_name,
          buyer_cpf,
          due_date
        ),
        payment_installments:installment_id (
          id,
          pmt,
          data_vencimento,
          numero_parcela
        )
      )
    `)
  
  // Apply filters if provided
  if (filters) {
    if (filters.companyId) {
      query = query.eq('company_id', filters.companyId)
    }
    
    if (filters.projectId) {
      query = query.eq('project_id', filters.projectId)
    }
    
    if (filters.statusEmissao) {
      query = query.eq('status_emissao', filters.statusEmissao)
    }
    
    if (filters.statusPagamento) {
      query = query.eq('status_pagamento', filters.statusPagamento)
    }
    
    if (filters.fromDate) {
      query = query.gte('data_vencimento', filters.fromDate)
    }
    
    if (filters.toDate) {
      query = query.lte('data_vencimento', filters.toDate)
    }
  }
  
  const { data: boletos, error } = await query.order('data_vencimento', { ascending: true })
  
  if (error) {
    console.error('Error fetching boletos:', error)
    throw error
  }
  
  return new Response(
    JSON.stringify({ 
      boletos,
      count: boletos.length
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  )
}

async function handleGetAvailableBillingReceivables(serviceClient, corsHeaders) {
  // This query gets billing receivables that don't have associated boletos yet
  const { data: availableReceivables, error } = await serviceClient.rpc(
    'execute_sql',
    {
      query_text: `
        SELECT 
          br.id,
          br.receivable_id,
          br.installment_id,
          br.nova_data_vencimento,
          r.amount,
          r.buyer_name,
          r.buyer_cpf,
          r.project_id,
          p.name AS project_name,
          p.cnpj AS project_cnpj,
          p.company_id,
          c.name AS company_name,
          ppi.numero_parcela,
          ppi.payment_plan_settings_id,
          pps.index_id,
          pps.adjustment_base_date,
          i.name AS index_name
        FROM 
          billing_receivables br
          JOIN receivables r ON br.receivable_id = r.id
          JOIN projects p ON r.project_id = p.id
          JOIN companies c ON p.company_id = c.id
          JOIN payment_plan_installments ppi ON br.installment_id = ppi.id
          JOIN payment_plan_settings pps ON ppi.payment_plan_settings_id = pps.id
          LEFT JOIN indexes i ON pps.index_id = i.id
        WHERE 
          NOT EXISTS (
            SELECT 1 FROM boletos b WHERE b.billing_receivable_id = br.id
          )
        ORDER BY 
          br.nova_data_vencimento ASC
      `,
      params: {}
    }
  )

  if (error) {
    console.error('Error fetching available billing receivables:', error)
    throw error
  }

  return new Response(
    JSON.stringify({ 
      billingReceivables: availableReceivables || [],
      count: (availableReceivables || []).length
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  )
}

async function handleCreateBoletos(serviceClient, billingReceivableIds, corsHeaders) {
  if (!billingReceivableIds || !Array.isArray(billingReceivableIds) || billingReceivableIds.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Billing receivable IDs are required' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }

  console.log(`Creating boletos for ${billingReceivableIds.length} billing receivables`)
  
  const createdBoletos = []
  const errors = []

  for (const brId of billingReceivableIds) {
    try {
      // First, check if a boleto already exists for this billing receivable
      const { data: existingBoleto } = await serviceClient
        .from('boletos')
        .select('id')
        .eq('billing_receivable_id', brId)
        .maybeSingle()

      if (existingBoleto) {
        console.log(`Boleto already exists for billing receivable ${brId}`)
        errors.push({
          billingReceivableId: brId,
          error: 'Boleto already exists for this billing receivable'
        })
        continue
      }

      // Get all required data for creating the boleto
      const { data: billingReceivableData, error: brError } = await serviceClient.rpc(
        'execute_sql',
        {
          query_text: `
            SELECT 
              br.id,
              br.nova_data_vencimento,
              r.amount AS valor_face,
              r.buyer_cpf AS payer_tax_id,
              r.project_id,
              p.cnpj AS project_tax_id,
              p.company_id,
              ppi.payment_plan_settings_id,
              pps.index_id,
              pps.adjustment_base_date
            FROM 
              billing_receivables br
              JOIN receivables r ON br.receivable_id = r.id
              JOIN projects p ON r.project_id = p.id
              JOIN payment_plan_installments ppi ON br.installment_id = ppi.id
              JOIN payment_plan_settings pps ON ppi.payment_plan_settings_id = pps.id
            WHERE 
              br.id = $1
          `,
          params: { 
            $1: brId 
          }
        }
      )

      if (brError) {
        console.error(`Error fetching data for billing receivable ${brId}:`, brError)
        errors.push({
          billingReceivableId: brId,
          error: brError.message
        })
        continue
      }

      const brInfo = billingReceivableData[0]
      if (!brInfo) {
        console.error(`Billing receivable ${brId} not found`)
        errors.push({
          billingReceivableId: brId,
          error: 'Billing receivable not found'
        })
        continue
      }

      // Calculate adjustment percentage if index is set
      let percentualAtualizacao = null
      let valorBoleto = brInfo.valor_face

      if (brInfo.index_id && brInfo.adjustment_base_date) {
        const currentDate = new Date().toISOString().split('T')[0] // Today in YYYY-MM-DD format
        
        // Get adjustment percentage from the database function
        const { data: adjustmentResult, error: adjustmentError } = await serviceClient.rpc(
          'calculate_index_adjustment',
          {
            p_index_id: brInfo.index_id,
            p_start_date: brInfo.adjustment_base_date,
            p_end_date: currentDate
          }
        )

        if (adjustmentError) {
          console.error(`Error calculating adjustment for boleto:`, adjustmentError)
        } else {
          percentualAtualizacao = adjustmentResult
          
          // Calculate valor_boleto with adjustment
          if (percentualAtualizacao !== null) {
            valorBoleto = parseFloat(brInfo.valor_face) * (1 + (percentualAtualizacao / 100))
            valorBoleto = Math.round(valorBoleto * 100) / 100 // Round to 2 decimal places
          }
        }
      }

      // Create the boleto
      const { data: boleto, error: createError } = await serviceClient
        .from('boletos')
        .insert({
          billing_receivable_id: brId,
          valor_face: brInfo.valor_face,
          index_id: brInfo.index_id || null,
          percentual_atualizacao: percentualAtualizacao,
          valor_boleto: valorBoleto,
          data_vencimento: brInfo.nova_data_vencimento,
          data_emissao: new Date().toISOString(),
          status_emissao: 'Criado',
          status_pagamento: 'N/A',
          payer_tax_id: brInfo.payer_tax_id,
          project_tax_id: brInfo.project_tax_id,
          project_id: brInfo.project_id,
          company_id: brInfo.company_id
        })
        .select()
        .single()

      if (createError) {
        console.error(`Error creating boleto for billing receivable ${brId}:`, createError)
        errors.push({
          billingReceivableId: brId,
          error: createError.message
        })
        continue
      }

      createdBoletos.push(boleto)
      console.log(`Created boleto ${boleto.id} for billing receivable ${brId}`)
    } catch (error) {
      console.error(`Error processing billing receivable ${brId}:`, error)
      errors.push({
        billingReceivableId: brId,
        error: error.message
      })
    }
  }

  return new Response(
    JSON.stringify({ 
      success: true,
      createdBoletos,
      errors,
      totalCreated: createdBoletos.length,
      totalErrors: errors.length
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  )
}

async function handleUpdateBoleto(serviceClient, boletoId, updateData, corsHeaders) {
  if (!boletoId) {
    return new Response(
      JSON.stringify({ error: 'Boleto ID is required' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }

  console.log(`Updating boleto ${boletoId} with data:`, updateData)

  // Get the current boleto data
  const { data: currentBoleto, error: getError } = await serviceClient
    .from('boletos')
    .select('*')
    .eq('id', boletoId)
    .single()

  if (getError) {
    console.error(`Error fetching boleto ${boletoId}:`, getError)
    return new Response(
      JSON.stringify({ error: `Boleto not found: ${getError.message}` }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404 
      }
    )
  }

  // Process status_emissao changes - update status_pagamento if needed
  if (updateData.status_emissao) {
    if (updateData.status_emissao === 'Criado' || updateData.status_emissao === 'Cancelado') {
      updateData.status_pagamento = 'N/A'
    } else if (updateData.status_emissao === 'Emitido' && currentBoleto.status_pagamento === 'N/A') {
      updateData.status_pagamento = 'Em Aberto'
    }
  }

  // Update the boleto
  const { data: updatedBoleto, error: updateError } = await serviceClient
    .from('boletos')
    .update(updateData)
    .eq('id', boletoId)
    .select()
    .single()

  if (updateError) {
    console.error(`Error updating boleto ${boletoId}:`, updateError)
    return new Response(
      JSON.stringify({ error: updateError.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }

  return new Response(
    JSON.stringify({ 
      success: true,
      boleto: updatedBoleto
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  )
}

async function handleDeleteBoleto(serviceClient, boletoId, corsHeaders) {
  if (!boletoId) {
    return new Response(
      JSON.stringify({ error: 'Boleto ID is required' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }

  console.log(`Deleting boleto ${boletoId}`)

  const { error: deleteError } = await serviceClient
    .from('boletos')
    .delete()
    .eq('id', boletoId)

  if (deleteError) {
    console.error(`Error deleting boleto ${boletoId}:`, deleteError)
    return new Response(
      JSON.stringify({ error: deleteError.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }

  return new Response(
    JSON.stringify({ 
      success: true,
      message: `Boleto ${boletoId} successfully deleted`
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  )
}
