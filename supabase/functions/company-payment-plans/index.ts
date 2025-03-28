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

    // Get user's company
    const { data: userCompany, error: userCompanyError } = await reqClient
      .from('user_companies')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    if (userCompanyError) {
      return new Response(
        JSON.stringify({ error: 'Error getting user company' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }

    if (!userCompany) {
      return new Response(
        JSON.stringify({ error: 'User not associated with any company' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403 
        }
      )
    }
    
    // Parse request to get action and data
    const { action, ...data } = await req.json()
    console.log(`Company payment plans action: ${action}`, data)

    const companyId = userCompany.company_id
    let responseData
    
    // Handle different actions
    switch (action) {
      case 'getCompanyPaymentPlans': {
        // Query payment plans from projects belonging to the company
        const { data: companyProjects, error: projectsError } = await supabase
          .from('projects')
          .select('id')
          .eq('company_id', companyId)
        
        if (projectsError) {
          throw new Error(`Error getting company projects: ${projectsError.message}`)
        }
        
        if (!companyProjects || companyProjects.length === 0) {
          // Return empty array if company has no projects
          responseData = []
          break
        }
        
        const projectIds = companyProjects.map(project => project.id)
        
        // Get payment plans for company projects
        const { data: paymentPlans, error: plansError } = await supabase
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
          .in('project_id', projectIds)
        
        if (plansError) {
          throw new Error(`Error getting payment plans: ${plansError.message}`)
        }
        
        responseData = paymentPlans || []
        break
      }

      case 'getPaymentPlanDetails': {
        const { paymentPlanId } = data
        
        if (!paymentPlanId) {
          throw new Error('Missing payment plan ID')
        }
        
        // First verify this payment plan belongs to the company
        const { data: planCheck, error: planCheckError } = await supabase
          .from('payment_plan_settings')
          .select(`
            projects!inner (
              company_id
            )
          `)
          .eq('id', paymentPlanId)
          .single()
        
        if (planCheckError) {
          throw new Error(`Error checking payment plan: ${planCheckError.message}`)
        }
        
        if (planCheck.projects.company_id !== companyId) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized to access this payment plan' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 403 
            }
          )
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
        
        // First verify this installment belongs to the company
        const { data: installmentCheck, error: installmentCheckError } = await supabase
          .from('payment_plan_installments')
          .select(`
            payment_plan_settings!inner (
              projects!inner (
                company_id
              )
            )
          `)
          .eq('id', installmentId)
          .single()
        
        if (installmentCheckError) {
          throw new Error(`Error checking installment: ${installmentCheckError.message}`)
        }
        
        if (installmentCheck.payment_plan_settings.projects.company_id !== companyId) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized to access this installment' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 403 
            }
          )
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
        
        // Get billing receivables - explicitly select nova_data_vencimento
        const { data: billingReceivables, error: billingError } = await supabase
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
          pmtReceivables: pmtReceivables || [],
          billingReceivables: billingReceivables || []
        }
        break
      }
      
      case 'removeBillingReceivable': {
        const { installmentId, billingReceivableId } = data
        
        if (!installmentId || !billingReceivableId) {
          throw new Error('Missing required parameters')
        }

        console.log(`Removing billing receivable ${billingReceivableId} from installment ${installmentId}`);
        
        // First verify this installment belongs to the company
        const { data: installmentCheck, error: installmentCheckError } = await supabase
          .from('payment_plan_installments')
          .select(`
            payment_plan_settings!inner (
              projects!inner (
                company_id
              )
            )
          `)
          .eq('id', installmentId)
          .single()
        
        if (installmentCheckError) {
          throw new Error(`Error checking installment access: ${installmentCheckError.message}`)
        }
        
        if (installmentCheck.payment_plan_settings.projects.company_id !== companyId) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized to access this installment' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 403 
            }
          )
        }

        // Get the specific billing receivable to verify it belongs to the installment and to get amount
        const { data: billingReceivable, error: brError } = await supabase
          .from('billing_receivables')
          .select(`
            id, 
            receivable_id,
            receivables (
              amount
            )
          `)
          .eq('id', billingReceivableId)
          .eq('installment_id', installmentId)
          .single();

        if (brError) {
          console.error('Error getting billing receivable:', brError);
          throw new Error(`Error getting billing receivable: ${brError.message}`)
        }

        // Get the amount of the receivable to be removed
        const removedAmount = parseFloat(billingReceivable.receivables.amount);
        console.log(`Removing receivable with amount: ${removedAmount}`);

        // Delete ONLY the specific billing receivable using a precise query with both ID conditions
        const { error: deleteError } = await supabase
          .from('billing_receivables')
          .delete()
          .eq('id', billingReceivableId)
          .eq('installment_id', installmentId);

        if (deleteError) {
          console.error('Error removing billing receivable:', deleteError);
          throw new Error(`Error removing billing receivable: ${deleteError.message}`)
        }
        
        console.log(`Successfully deleted billing receivable ${billingReceivableId}`);

        // Get remaining billing receivables to recalculate total amount
        const { data: remainingReceivables, error: remainingError } = await supabase
          .from('billing_receivables')
          .select(`
            receivable_id,
            receivables (
              amount
            )
          `)
          .eq('installment_id', installmentId);

        if (remainingError) {
          console.error('Error getting remaining receivables:', remainingError);
          throw new Error(`Error getting remaining receivables: ${remainingError.message}`)
        }

        // Calculate new total amount
        const totalAmount = (remainingReceivables || []).reduce(
          (sum, item) => sum + parseFloat(item.receivables.amount), 
          0
        );
        
        console.log(`Calculated new total amount for installment: ${totalAmount}`);

        // Get payment plan settings ID for the installment
        const { data: installment, error: installmentError } = await supabase
          .from('payment_plan_installments')
          .select('payment_plan_settings_id')
          .eq('id', installmentId)
          .single();

        if (installmentError) {
          console.error('Error getting installment:', installmentError);
          throw new Error(`Error getting installment: ${installmentError.message}`)
        }

        // Update installment with new recebiveis value
        console.log(`Updating installment ${installmentId} with new recebiveis value: ${totalAmount}`);
        const { data: updatedInstallment, error: updateError } = await supabase
          .from('payment_plan_installments')
          .update({ recebiveis: totalAmount })
          .eq('id', installmentId)
          .select('*');

        if (updateError) {
          console.error('Error updating installment:', updateError);
          throw new Error(`Error updating installment: ${updateError.message}`)
        }
        
        console.log('Successfully updated installment with new recebiveis value');

        // Recalculate payment plan
        console.log(`Recalculating payment plan for settings_id ${installment.payment_plan_settings_id}`);
        const { error: calcError } = await supabase.rpc(
          'calculate_payment_plan_installments',
          { p_payment_plan_settings_id: installment.payment_plan_settings_id }
        );

        if (calcError) {
          console.error('Error recalculating payment plan:', calcError);
          throw new Error(`Error recalculating payment plan: ${calcError.message}`)
        }
        
        console.log('Payment plan recalculation succeeded');

        responseData = { 
          success: true,
          removedReceivableId: billingReceivable.receivable_id,
          newTotal: totalAmount,
          updatedInstallment: updatedInstallment ? updatedInstallment[0] : null
        }
        break
      }
      
      case 'updatePaymentPlanSettings': {
        const { paymentPlanId, indexId, adjustmentBaseDate } = data
        
        if (!paymentPlanId) {
          throw new Error('Missing payment plan ID')
        }
        
        // First verify this payment plan belongs to the company
        const { data: planCheck, error: planCheckError } = await supabase
          .from('payment_plan_settings')
          .select(`
            projects!inner (
              company_id
            )
          `)
          .eq('id', paymentPlanId)
          .single()
        
        if (planCheckError) {
          throw new Error(`Error checking payment plan: ${planCheckError.message}`)
        }
        
        if (planCheck.projects.company_id !== companyId) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized to access this payment plan' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 403 
            }
          )
        }
        
        // Update payment plan settings
        let updateData = {}
        
        // Only include fields that are provided
        if (indexId !== undefined) {
          updateData.index_id = indexId
        }
        
        if (adjustmentBaseDate !== undefined) {
          updateData.adjustment_base_date = adjustmentBaseDate
        }
        
        // Update the payment plan settings
        const { data: updatedPlan, error: updateError } = await supabase
          .from('payment_plan_settings')
          .update(updateData)
          .eq('id', paymentPlanId)
          .select('*')
          .single()
        
        if (updateError) {
          throw new Error(`Error updating payment plan settings: ${updateError.message}`)
        }
        
        responseData = updatedPlan
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
    console.error(`Error handling payment plans request:`, error)
    
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
