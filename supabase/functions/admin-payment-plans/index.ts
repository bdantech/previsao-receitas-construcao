import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

// CORS headers
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
    // Get the Supabase URL and service role key from environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
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

    // Initialize Supabase client with Service Role Key
    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey
    )

    // Authenticate user
    const reqClient = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        global: {
          headers: {
            Authorization: authHeader
          },
        },
      }
    )

    const { data: { user }, error: authError } = await reqClient.auth.getUser()
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await reqClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      return new Response(
        JSON.stringify({ error: 'Error checking user permissions' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
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

    // Parse request to get action and data
    const { action, ...data } = await req.json()
    console.log(`Admin payment plans action: ${action}`, data)

    let responseData
    let error = null

    // Handle different actions
    switch (action) {
      case 'createPaymentPlan': {
        const { anticipationRequestId, diaCobranca, tetoFundoReserva } = data
        
        if (!anticipationRequestId || !diaCobranca || tetoFundoReserva === undefined) {
          throw new Error('Missing required fields')
        }

        // Get project ID from anticipation request
        const { data: anticipation, error: anticipationError } = await supabase
          .from('anticipation_requests')
          .select('project_id')
          .eq('id', anticipationRequestId)
          .single()

        if (anticipationError) {
          throw new Error(`Error getting anticipation request: ${anticipationError.message}`)
        }

        // Create payment plan settings
        const { data: settings, error: settingsError } = await supabase
          .from('payment_plan_settings')
          .insert({
            anticipation_request_id: anticipationRequestId,
            dia_cobranca: diaCobranca,
            teto_fundo_reserva: tetoFundoReserva,
            project_id: anticipation.project_id
          })
          .select('id')
          .single()

        if (settingsError) {
          throw new Error(`Error creating payment plan settings: ${settingsError.message}`)
        }

        // Calculate installments using the database function
        const { data: calResult, error: calError } = await supabase.rpc(
          'calculate_payment_plan_installments',
          { p_payment_plan_settings_id: settings.id }
        )

        if (calError) {
          throw new Error(`Error calculating installments: ${calError.message}`)
        }

        // Get created payment plan with installments
        const { data: paymentPlan, error: ppError } = await supabase
          .from('payment_plan_settings')
          .select(`
            id, 
            dia_cobranca, 
            teto_fundo_reserva,
            anticipation_request_id,
            project_id,
            payment_plan_installments (
              id,
              numero_parcela,
              data_vencimento,
              recebiveis,
              pmt,
              saldo_devedor,
              fundo_reserva,
              devolucao
            )
          `)
          .eq('id', settings.id)
          .single()

        if (ppError) {
          throw new Error(`Error getting created payment plan: ${ppError.message}`)
        }

        responseData = paymentPlan
        break
      }

      case 'getPaymentPlans': {
        const { projectId, anticipationRequestId } = data
        
        let query = supabase
          .from('payment_plan_settings')
          .select(`
            id, 
            dia_cobranca, 
            teto_fundo_reserva,
            anticipation_request_id,
            project_id,
            created_at,
            updated_at,
            anticipation_requests (
              valor_total,
              valor_liquido,
              status
            ),
            projects (
              name,
              cnpj
            )
          `)

        if (projectId) {
          query = query.eq('project_id', projectId)
        }

        if (anticipationRequestId) {
          query = query.eq('anticipation_request_id', anticipationRequestId)
        }

        const { data: paymentPlans, error: plansError } = await query
        
        if (plansError) {
          throw new Error(`Error getting payment plans: ${plansError.message}`)
        }

        responseData = paymentPlans
        break
      }

      case 'getPaymentPlanDetails': {
        const { paymentPlanId } = data
        
        if (!paymentPlanId) {
          throw new Error('Missing payment plan ID')
        }

        // Get payment plan details with installments
        const { data: paymentPlan, error: ppError } = await supabase
          .from('payment_plan_settings')
          .select(`
            id, 
            dia_cobranca, 
            teto_fundo_reserva,
            anticipation_request_id,
            project_id,
            created_at,
            updated_at,
            anticipation_requests (
              valor_total,
              valor_liquido,
              status
            ),
            projects (
              name,
              cnpj
            ),
            payment_plan_installments (
              id,
              numero_parcela,
              data_vencimento,
              recebiveis,
              pmt,
              saldo_devedor,
              fundo_reserva,
              devolucao
            )
          `)
          .eq('id', paymentPlanId)
          .single()

        if (ppError) {
          throw new Error(`Error getting payment plan details: ${ppError.message}`)
        }

        responseData = paymentPlan
        break
      }

      case 'getInstallmentReceivables': {
        const { installmentId } = data
        
        if (!installmentId) {
          throw new Error('Missing installment ID')
        }

        // Get PMT receivables
        const { data: pmtReceivables, error: pmtError } = await supabase
          .from('pmt_receivables')
          .select(`
            id,
            receivable_id,
            receivables (
              id,
              buyer_name,
              buyer_cpf,
              amount,
              due_date,
              description,
              status
            )
          `)
          .eq('installment_id', installmentId)

        if (pmtError) {
          throw new Error(`Error getting PMT receivables: ${pmtError.message}`)
        }

        // Get billing receivables
        const { data: billingReceivables, error: billingError } = await supabase
          .from('billing_receivables')
          .select(`
            id,
            receivable_id,
            receivables (
              id,
              buyer_name,
              buyer_cpf,
              amount,
              due_date,
              description,
              status
            )
          `)
          .eq('installment_id', installmentId)

        if (billingError) {
          throw new Error(`Error getting billing receivables: ${billingError.message}`)
        }

        responseData = {
          pmtReceivables: pmtReceivables,
          billingReceivables: billingReceivables
        }
        break
      }

      case 'updateBillingReceivables': {
        const { installmentId, receivableIds } = data
        
        if (!installmentId || !receivableIds || !Array.isArray(receivableIds)) {
          throw new Error('Missing or invalid required fields')
        }

        // Get installment details to check project ID
        const { data: installment, error: installmentError } = await supabase
          .from('payment_plan_installments')
          .select('project_id')
          .eq('id', installmentId)
          .single()

        if (installmentError) {
          throw new Error(`Error getting installment: ${installmentError.message}`)
        }

        // Verify that all receivables belong to the same project
        const { data: receivables, error: receivablesError } = await supabase
          .from('receivables')
          .select('id, amount')
          .in('id', receivableIds)
          .eq('project_id', installment.project_id)

        if (receivablesError) {
          throw new Error(`Error getting receivables: ${receivablesError.message}`)
        }

        if (receivables.length !== receivableIds.length) {
          throw new Error('Some receivables do not belong to the project or do not exist')
        }

        // Clear existing billing receivables for this installment
        const { error: deleteError } = await supabase
          .from('billing_receivables')
          .delete()
          .eq('installment_id', installmentId)

        if (deleteError) {
          throw new Error(`Error deleting existing billing receivables: ${deleteError.message}`)
        }

        // Insert new billing receivables
        const billingReceivables = receivableIds.map(receivableId => ({
          installment_id: installmentId,
          receivable_id: receivableId
        }))

        const { error: insertError } = await supabase
          .from('billing_receivables')
          .insert(billingReceivables)

        if (insertError) {
          throw new Error(`Error inserting billing receivables: ${insertError.message}`)
        }

        // Calculate total amount of receivables
        const totalAmount = receivables.reduce((sum, receivable) => sum + parseFloat(receivable.amount), 0)

        // Update installment with new recebiveis value
        const { data: updatedInstallment, error: updateError } = await supabase
          .from('payment_plan_installments')
          .update({ recebiveis: totalAmount })
          .eq('id', installmentId)
          .select()
          .single()

        if (updateError) {
          throw new Error(`Error updating installment: ${updateError.message}`)
        }

        // Recalculate payment plan
        const { data: installmentData, error: getError } = await supabase
          .from('payment_plan_installments')
          .select('payment_plan_settings_id')
          .eq('id', installmentId)
          .single()

        if (getError) {
          throw new Error(`Error getting payment plan settings id: ${getError.message}`)
        }

        // Run the calculation function again to update fundo_reserva and devolucao
        const { error: calcError } = await supabase.rpc(
          'calculate_payment_plan_installments',
          { p_payment_plan_settings_id: installmentData.payment_plan_settings_id }
        )

        if (calcError) {
          throw new Error(`Error recalculating payment plan: ${calcError.message}`)
        }

        responseData = { success: true, updatedInstallment }
        break
      }

      case 'deletePaymentPlan': {
        const { paymentPlanId } = data
        
        if (!paymentPlanId) {
          throw new Error('Missing payment plan ID')
        }

        // Delete associated billing receivables first
        const { error: brError } = await supabase.rpc('execute_sql', {
          params: {},
          query_text: `
            DELETE FROM public.billing_receivables
            WHERE installment_id IN (
              SELECT id FROM public.payment_plan_installments
              WHERE payment_plan_settings_id = '${paymentPlanId}'
            )
          `
        })

        if (brError) {
          throw new Error(`Error deleting billing receivables: ${brError.message}`)
        }

        // Delete associated pmt receivables
        const { error: pmtError } = await supabase.rpc('execute_sql', {
          params: {},
          query_text: `
            DELETE FROM public.pmt_receivables
            WHERE installment_id IN (
              SELECT id FROM public.payment_plan_installments
              WHERE payment_plan_settings_id = '${paymentPlanId}'
            )
          `
        })

        if (pmtError) {
          throw new Error(`Error deleting PMT receivables: ${pmtError.message}`)
        }

        // Delete installments
        const { error: installmentsError } = await supabase
          .from('payment_plan_installments')
          .delete()
          .eq('payment_plan_settings_id', paymentPlanId)

        if (installmentsError) {
          throw new Error(`Error deleting installments: ${installmentsError.message}`)
        }

        // Delete payment plan settings
        const { error: settingsError } = await supabase
          .from('payment_plan_settings')
          .delete()
          .eq('id', paymentPlanId)

        if (settingsError) {
          throw new Error(`Error deleting payment plan settings: ${settingsError.message}`)
        }

        responseData = { success: true }
        break
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }

    return new Response(
      JSON.stringify({ data: responseData }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error(`Error handling admin payment plans request:`, error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
