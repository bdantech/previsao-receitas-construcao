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
        // ... keep existing code (createPaymentPlan case)
        break;
      }

      case 'getPaymentPlans': {
        // ... keep existing code (getPaymentPlans case)
        break;
      }

      case 'getPaymentPlanDetails': {
        // ... keep existing code (getPaymentPlanDetails case)
        break;
      }

      case 'getInstallmentReceivables': {
        // ... keep existing code (getInstallmentReceivables case)
        break;
      }

      case 'getEligibleBillingReceivables': {
        const { paymentPlanId, installmentId } = data
        
        if (!paymentPlanId || !installmentId) {
          throw new Error('Missing required parameters')
        }

        // Get payment plan details
        const { data: paymentPlan, error: ppError } = await supabase
          .from('payment_plan_settings')
          .select(`
            id,
            project_id,
            anticipation_request_id
          `)
          .eq('id', paymentPlanId)
          .single()

        if (ppError) {
          throw new Error(`Error getting payment plan: ${ppError.message}`)
        }

        // Get the selected installment to determine the month/year constraints
        const { data: installment, error: instError } = await supabase
          .from('payment_plan_installments')
          .select('data_vencimento')
          .eq('id', installmentId)
          .single()

        if (instError) {
          throw new Error(`Error getting installment: ${instError.message}`)
        }
        
        // Parse the installment date to extract year and month
        const installmentDate = new Date(installment.data_vencimento)
        const year = installmentDate.getFullYear()
        const month = installmentDate.getMonth()
        
        // Calculate first and last day of the month
        const firstDayOfMonth = new Date(year, month, 1).toISOString().split('T')[0]
        const lastDayOfMonth = new Date(year, month + 1, 0).toISOString().split('T')[0]

        console.log(`Date range: ${firstDayOfMonth} to ${lastDayOfMonth}`)

        // Get list of receivables already in billing_receivables (to exclude them)
        const { data: existingBillingReceivables, error: existingError } = await supabase
          .from('billing_receivables')
          .select('receivable_id')

        if (existingError) {
          throw new Error(`Error getting existing billing receivables: ${existingError.message}`)
        }

        // Extract the IDs of receivables already in billing_receivables
        const existingReceivableIds = (existingBillingReceivables || [])
          .map(item => item.receivable_id)
          .filter(id => id !== null);

        // Get eligible receivables
        let query = supabase
          .from('receivables')
          .select(`
            id,
            buyer_name,
            buyer_cpf,
            amount,
            due_date,
            description,
            status
          `)
          .eq('project_id', paymentPlan.project_id)
          .gte('due_date', firstDayOfMonth)
          .lte('due_date', lastDayOfMonth)
          .eq('status', 'antecipado') // Changed to only show 'antecipado' status

        // Exclude already linked receivables if there are any
        if (existingReceivableIds.length > 0) {
          query = query.not('id', 'in', `(${existingReceivableIds.join(',')})`)
        }

        const { data: eligibleReceivables, error: eligibleError } = await query

        if (eligibleError) {
          throw new Error(`Error getting eligible receivables: ${eligibleError.message}`)
        }

        responseData = eligibleReceivables || []
        break
      }

      case 'updateBillingReceivables': {
        // ... keep existing code (updateBillingReceivables case)
        break;
      }

      case 'removeBillingReceivable': {
        // ... keep existing code (removeBillingReceivable case)
        break;
      }

      case 'deletePaymentPlan': {
        // ... keep existing code (deletePaymentPlan case)
        break;
      }

      case 'updatePaymentPlanSettings': {
        // ... keep existing code (updatePaymentPlanSettings case)
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify({ data: responseData }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error(`Error handling admin payment plans request:`, error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
})
