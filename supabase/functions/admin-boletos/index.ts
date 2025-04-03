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
        const { fromDate, toDate } = data || {}
        return await handleGetAvailableBillingReceivables(serviceClient, fromDate, toDate, corsHeaders)
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

async function handleGetAvailableBillingReceivables(serviceClient, fromDate, toDate, corsHeaders) {
  console.log('Getting available billing receivables', { fromDate, toDate });
  
  try {
    // First, get all the billing_receivable_ids that already have boletos
    const { data: existingBoletoReceipts, error: existingError } = await serviceClient
      .from('boletos')
      .select('billing_receivable_id')
      .not('billing_receivable_id', 'is', null);
    
    if (existingError) {
      console.error('Error fetching existing boleto receipts:', existingError);
      throw existingError;
    }
    
    // Extract the IDs to an array
    const existingIds = existingBoletoReceipts.map(b => b.billing_receivable_id);
    console.log(`Found ${existingIds.length} existing boleto receipts to exclude`);
    
    // Now get all billing receivables that don't have boletos yet
    let query = serviceClient
      .from('billing_receivables')
      .select(`
        id,
        nova_data_vencimento,
        receivable_id,
        installment_id,
        receivables (
          id,
          amount,
          buyer_name,
          buyer_cpf,
          due_date,
          project_id
        ),
        payment_installments:installment_id (
          id,
          numero_parcela,
          payment_plan_settings (
            index_id,
            adjustment_base_date,
            project_id,
            projects (
              id,
              name,
              cnpj,
              company_id,
              companies (
                id,
                name
              )
            )
          )
        )
      `)
      .order('nova_data_vencimento', { ascending: true });
    
    // If we have existing boletos, exclude their billing_receivable_ids
    if (existingIds.length > 0) {
      query = query.not('id', 'in', `(${existingIds.join(',')})`);
    }
    
    // Apply date filters if provided
    if (fromDate) {
      query = query.gte('nova_data_vencimento', fromDate);
    }
    
    if (toDate) {
      query = query.lte('nova_data_vencimento', toDate);
    }
    
    const { data, error } = await query.limit(100);

    if (error) {
      console.error('Error fetching available billing receivables:', error);
      throw error;
    }

    console.log(`Successfully fetched ${data?.length || 0} available billing receivables`);

    // Transform the data into the expected format
    const transformedData = (data || []).map(br => {
      // Extract project and company info
      const projectId = br.receivables?.project_id || br.payment_installments?.payment_plan_settings?.project_id;
      const projectName = br.payment_installments?.payment_plan_settings?.projects?.name || 'Unknown Project';
      const projectCnpj = br.payment_installments?.payment_plan_settings?.projects?.cnpj || '';
      const companyId = br.payment_installments?.payment_plan_settings?.projects?.company_id || '';
      const companyName = br.payment_installments?.payment_plan_settings?.projects?.companies?.name || 'Unknown Company';
      
      return {
        id: br.id,
        nova_data_vencimento: br.nova_data_vencimento,
        amount: br.receivables?.amount || 0,
        buyer_name: br.receivables?.buyer_name || '',
        buyer_cpf: br.receivables?.buyer_cpf || '',
        project_id: projectId,
        project_name: projectName,
        project_cnpj: projectCnpj,
        company_id: companyId,
        company_name: companyName,
        numero_parcela: br.payment_installments?.numero_parcela || 0,
        index_id: br.payment_installments?.payment_plan_settings?.index_id || null,
        index_name: null, // This will be added in a subsequent query if needed
        adjustment_base_date: br.payment_installments?.payment_plan_settings?.adjustment_base_date || null
      };
    });
    
    // Get index names for the ones that have index_id
    const indexIds = transformedData
      .filter(item => item.index_id)
      .map(item => item.index_id);
      
    if (indexIds.length > 0) {
      const { data: indexesData, error: indexesError } = await serviceClient
        .from('indexes')
        .select('id, name')
        .in('id', indexIds);
        
      if (!indexesError && indexesData) {
        // Add index names to the transformed data
        transformedData.forEach(item => {
          if (item.index_id) {
            const index = indexesData.find(idx => idx.id === item.index_id);
            if (index) {
              item.index_name = index.name;
            }
          }
        });
      }
    }
    
    const resultCount = transformedData.length;
    console.log(`Returning ${resultCount} available billing receivables`);

    return new Response(
      JSON.stringify({ 
        billingReceivables: transformedData,
        count: resultCount
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in handleGetAvailableBillingReceivables:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        billingReceivables: [],
        count: 0
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
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

      // Get the billing receivable data directly
      const { data: billingReceivableData, error: brQueryError } = await serviceClient
        .from('billing_receivables')
        .select(`
          id,
          nova_data_vencimento,
          receivable_id,
          installment_id,
          receivables:receivable_id (
            id,
            amount,
            buyer_cpf,
            project_id
          ),
          payment_installments:installment_id (
            id,
            numero_parcela,
            payment_plan_settings (
              index_id,
              adjustment_base_date,
              project_id,
              projects:project_id (
                id,
                cnpj,
                company_id
              )
            )
          )
        `)
        .eq('id', brId)
        .single();

      if (brQueryError) {
        console.error(`Error fetching billing receivable ${brId}:`, brQueryError)
        errors.push({
          billingReceivableId: brId,
          error: brQueryError.message
        })
        continue
      }

      if (!billingReceivableData) {
        console.error(`Billing receivable ${brId} not found`)
        errors.push({
          billingReceivableId: brId,
          error: 'Billing receivable not found'
        })
        continue
      }

      console.log(`Processing billing receivable: ${JSON.stringify(billingReceivableData, null, 2)}`)

      // Extract the necessary data
      const {
        nova_data_vencimento,
        receivables,
        payment_installments
      } = billingReceivableData;

      if (!receivables) {
        console.error(`Receivable data not found for billing receivable ${brId}`)
        errors.push({
          billingReceivableId: brId,
          error: 'Receivable data not found'
        })
        continue
      }

      if (!payment_installments?.payment_plan_settings?.projects) {
        console.error(`Project data not found for billing receivable ${brId}`)
        errors.push({
          billingReceivableId: brId,
          error: 'Project data not found'
        })
        continue
      }

      const valorFace = receivables.amount;
      const payerTaxId = receivables.buyer_cpf;
      const projectId = receivables.project_id;
      const projectTaxId = payment_installments.payment_plan_settings.projects.cnpj;
      const companyId = payment_installments.payment_plan_settings.projects.company_id;
      const indexId = payment_installments.payment_plan_settings.index_id;
      const adjustmentBaseDate = payment_installments.payment_plan_settings.adjustment_base_date;

      // Calculate adjustment percentage if index is set
      let percentualAtualizacao = null
      let valorBoleto = valorFace

      if (indexId && adjustmentBaseDate) {
        const currentDate = new Date().toISOString().split('T')[0] // Today in YYYY-MM-DD format
        
        // Get adjustment percentage from the database function
        const { data: adjustmentResult, error: adjustmentError } = await serviceClient.rpc(
          'calculate_index_adjustment',
          {
            p_index_id: indexId,
            p_start_date: adjustmentBaseDate,
            p_end_date: currentDate
          }
        )

        if (adjustmentError) {
          console.error(`Error calculating adjustment for boleto:`, adjustmentError)
        } else {
          percentualAtualizacao = adjustmentResult
          
          // Calculate valor_boleto with adjustment
          if (percentualAtualizacao !== null) {
            valorBoleto = parseFloat(valorFace) * (1 + (percentualAtualizacao / 100))
            valorBoleto = Math.round(valorBoleto * 100) / 100 // Round to 2 decimal places
          }
        }
      }

      // Create the boleto
      const { data: boleto, error: createError } = await serviceClient
        .from('boletos')
        .insert({
          billing_receivable_id: brId,
          valor_face: valorFace,
          index_id: indexId || null,
          percentual_atualizacao: percentualAtualizacao,
          valor_boleto: valorBoleto,
          data_vencimento: nova_data_vencimento,
          data_emissao: new Date().toISOString(),
          status_emissao: 'Criado',
          status_pagamento: 'N/A',
          payer_tax_id: payerTaxId,
          project_tax_id: projectTaxId,
          project_id: projectId,
          company_id: companyId
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
