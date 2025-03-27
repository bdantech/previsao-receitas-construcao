
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

    // Initialize Supabase client
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

    // Initialize admin client
    const adminClient = createClient(
      supabaseUrl,
      supabaseServiceKey
    )

    // Check if user is company_user
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

    if (profile.role !== 'company_user') {
      return new Response(
        JSON.stringify({ error: 'Company user access required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403 
        }
      )
    }

    // Get the company ID of the user
    const { data: userCompanies, error: companiesError } = await reqClient
      .from('user_companies')
      .select('company_id')
      .eq('user_id', user.id)

    if (companiesError || !userCompanies || userCompanies.length === 0) {
      return new Response(
        JSON.stringify({ error: 'User is not associated with any company' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403 
        }
      )
    }

    const companyIds = userCompanies.map(uc => uc.company_id)

    // Parse request to get action and data
    const { action, ...data } = await req.json()
    console.log(`Company payment plans action: ${action}`, data)

    let responseData
    let error = null

    // Handle different actions
    switch (action) {
      case 'getPaymentPlans': {
        const { projectId } = data
        
        // Build base query to get payment plans for the company's projects
        let query = adminClient
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
              id,
              name,
              cnpj
            )
          `)
          .in('projects.company_id', companyIds)

        // Add project filter if provided
        if (projectId) {
          query = query.eq('project_id', projectId)
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

        // First check if this payment plan belongs to one of the user's companies
        const { data: paymentPlan, error: checkError } = await adminClient
          .from('payment_plan_settings')
          .select(`
            id,
            projects!inner (
              company_id
            )
          `)
          .eq('id', paymentPlanId)
          .single()

        if (checkError) {
          throw new Error(`Error checking payment plan: ${checkError.message}`)
        }

        if (!companyIds.includes(paymentPlan.projects.company_id)) {
          return new Response(
            JSON.stringify({ error: 'Access denied to this payment plan' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 403 
            }
          )
        }

        // Get payment plan details with installments
        const { data: planDetails, error: ppError } = await adminClient
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

        responseData = planDetails
        break
      }

      case 'getInstallmentReceivables': {
        const { installmentId } = data
        
        if (!installmentId) {
          throw new Error('Missing installment ID')
        }

        // First check if this installment belongs to one of the user's companies
        const { data: installment, error: checkError } = await adminClient
          .from('payment_plan_installments')
          .select(`
            id,
            payment_plan_settings!inner (
              project_id
            ),
            projects:payment_plan_settings!inner(
              projects(
                company_id
              )
            )
          `)
          .eq('id', installmentId)
          .single()

        if (checkError) {
          throw new Error(`Error checking installment: ${checkError.message}`)
        }

        if (!companyIds.includes(installment.projects.company_id)) {
          return new Response(
            JSON.stringify({ error: 'Access denied to this installment' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 403 
            }
          )
        }

        // Get PMT receivables
        const { data: pmtReceivables, error: pmtError } = await adminClient
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
        const { data: billingReceivables, error: billingError } = await adminClient
          .from('billing_receivables')
          .select(`
            id,
            receivable_id,
            nova_data_vencimento,
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
    console.error(`Error handling company payment plans request:`, error)
    
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
