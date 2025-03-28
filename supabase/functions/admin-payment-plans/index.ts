import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

interface PaymentPlanInstallment {
  id: string
  numero_parcela: number
  data_vencimento: string
  pmt: number
  saldo_devedor: number
  fundo_reserva: number
  devolucao: number
  recebiveis: number
}

// Define the payment plan structure for type safety
interface PaymentPlan {
  id: string
  dia_cobranca: number
  teto_fundo_reserva: number
  anticipation_request_id: string
  project_id: string
  created_at: string
  updated_at: string
  index_id?: string
  adjustment_base_date?: string
  anticipation_requests: {
    valor_total: number
    valor_liquido: number
    status: string
  }
  projects: {
    name: string
    cnpj: string
  }
  payment_plan_installments: PaymentPlanInstallment[]
}

interface BillingReceivable {
  id: string
  installment_id: string
  receivable_id: string
  nova_data_vencimento?: string
  receivables: {
    buyer_name: string
    buyer_cpf: string
    amount: number
    due_date: string
    description: string
    status: string
  }
}

interface PmtReceivable {
  id: string
  installment_id: string
  receivable_id: string
  receivables: {
    buyer_name: string
    buyer_cpf: string
    amount: number
    due_date: string
    description: string
    status: string
  }
}

// Function to get payment plans
const getPaymentPlans = async (supabase: any) => {
  const { data, error } = await supabase
    .from('payment_plan_settings')
    .select(`
      id,
      dia_cobranca,
      teto_fundo_reserva,
      anticipation_request_id,
      project_id,
      created_at,
      updated_at,
      index_id,
      adjustment_base_date,
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
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching payment plans:', error)
    throw new Error(`Error fetching payment plans: ${error.message}`)
  }

  return data
}

serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') as string
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Verify admin role
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header missing' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Process request
    const { data } = await req.json()
    const { action } = data
    console.log(`Admin payment plans action: ${action}`, data)

    let responseData = null

    switch (action) {
      case 'getPaymentPlans': {
        responseData = await getPaymentPlans(supabase)
        break
      }

      case 'getPaymentPlanDetails': {
        const { paymentPlanId } = data
        
        if (!paymentPlanId) {
          throw new Error('Missing required payment plan ID')
        }

        // Get payment plan details
        const { data: paymentPlan, error: planError } = await supabase
          .from('payment_plan_settings')
          .select(`
            id,
            dia_cobranca,
            teto_fundo_reserva,
            anticipation_request_id,
            project_id,
            created_at,
            updated_at,
            index_id,
            adjustment_base_date,
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
          .eq('id', paymentPlanId)
          .single()

        if (planError) {
          console.error("Error fetching payment plan:", planError)
          throw new Error(`Error fetching payment plan: ${planError.message}`)
        }

        if (!paymentPlan) {
          throw new Error('Payment plan not found')
        }

        // Get payment plan installments
        const { data: installments, error: installmentsError } = await supabase
          .from('payment_plan_installments')
          .select('*')
          .eq('payment_plan_settings_id', paymentPlanId)

        if (installmentsError) {
          console.error("Error fetching payment plan installments:", installmentsError)
          throw new Error(`Error fetching payment plan installments: ${installmentsError.message}`)
        }

        // Calculate receivables sum for each installment
        const installmentsWithReceivables = await Promise.all(
          installments.map(async (installment) => {
            // Get PMT receivables
            const { data: pmtReceivables, error: pmtError } = await supabase
              .from('pmt_receivables')
              .select(`
                installment_id,
                receivable_id,
                receivables (amount)
              `)
              .eq('installment_id', installment.id)

            if (pmtError) {
              console.error(`Error fetching PMT receivables for installment ${installment.id}:`, pmtError)
              return installment
            }

            // Calculate total receivables
            const receivablesSum = pmtReceivables.reduce((sum, pmt) => {
              return sum + (pmt.receivables?.amount || 0)
            }, 0)

            return {
              ...installment,
              recebiveis: receivablesSum
            }
          })
        )

        // Return complete payment plan data
        responseData = {
          ...paymentPlan,
          payment_plan_installments: installmentsWithReceivables
        }
        break
      }

      case 'getInstallmentReceivables': {
        const { installmentId } = data

        if (!installmentId) {
          throw new Error('Missing required installment ID')
        }

        // Get PMT receivables
        const { data: pmtReceivables, error: pmtError } = await supabase
          .from('pmt_receivables')
          .select(`
            id,
            installment_id,
            receivable_id,
            receivables (
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
          console.error("Error fetching PMT receivables:", pmtError)
          throw new Error(`Error fetching PMT receivables: ${pmtError.message}`)
        }

        // Get billing receivables
        const { data: billingReceivables, error: billingError } = await supabase
          .from('billing_receivables')
          .select(`
            id,
            installment_id,
            receivable_id,
            nova_data_vencimento,
            receivables (
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
          console.error("Error fetching billing receivables:", billingError)
          throw new Error(`Error fetching billing receivables: ${billingError.message}`)
        }

        responseData = {
          pmtReceivables,
          billingReceivables
        }
        break
      }

      case 'getEligibleBillingReceivables': {
        const { paymentPlanId, installmentId } = data

        if (!paymentPlanId || !installmentId) {
          throw new Error('Missing required payment plan or installment ID')
        }

        // Fetch receivables that are not yet linked to any billing_receivables record for the given installment
        const { data: eligibleReceivables, error: eligibleError } = await supabase
          .from('receivables')
          .select('*')
          .not('id', 'in',
            supabase
              .from('billing_receivables')
              .select('receivable_id')
              .eq('installment_id', installmentId)
          )
          .eq('payment_plan_id', paymentPlanId)
          .eq('status', 'Em Aberto')

        if (eligibleError) {
          console.error("Error fetching eligible receivables:", eligibleError)
          throw new Error(`Error fetching eligible receivables: ${eligibleError.message}`)
        }

        responseData = eligibleReceivables
        break
      }

      case 'deletePaymentPlan': {
        const { paymentPlanId } = data

        if (!paymentPlanId) {
          throw new Error('Missing required payment plan ID')
        }

        // Delete payment plan settings
        const { error: deleteError } = await supabase
          .from('payment_plan_settings')
          .delete()
          .eq('id', paymentPlanId)

        if (deleteError) {
          console.error("Error deleting payment plan:", deleteError)
          throw new Error(`Error deleting payment plan: ${deleteError.message}`)
        }

        break
      }

      case 'removeBillingReceivable': {
        const { installmentId, billingReceivableId } = data

        if (!installmentId || !billingReceivableId) {
          throw new Error('Missing required installment or billing receivable ID')
        }

        // Delete billing receivable
        const { error: removeError } = await supabase
          .from('billing_receivables')
          .delete()
          .eq('id', billingReceivableId)
          .eq('installment_id', installmentId)

        if (removeError) {
          console.error("Error removing billing receivable:", removeError)
          throw new Error(`Error removing billing receivable: ${removeError.message}`)
        }

        break
      }

      case 'updatePaymentPlanSettings': {
        const { paymentPlanId, indexId, adjustmentBaseDate } = data
        
        if (!paymentPlanId) {
          throw new Error('Missing required payment plan ID')
        }
        
        console.log(`Updating payment plan settings for ID: ${paymentPlanId}`, { 
          indexId: indexId || 'null', 
          adjustmentBaseDate: adjustmentBaseDate || 'null' 
        })

        // Update payment plan settings
        const { data: updatedSettings, error: updateError } = await supabase
          .from('payment_plan_settings')
          .update({
            index_id: indexId,
            adjustment_base_date: adjustmentBaseDate
          })
          .eq('id', paymentPlanId)
          .select('*')
          .single()

        if (updateError) {
          console.error("Error updating payment plan settings:", updateError)
          throw new Error(`Error updating payment plan settings: ${updateError.message}`)
        }

        console.log("Successfully updated payment plan settings:", updatedSettings)
        responseData = updatedSettings
        break
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify({ data: responseData }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error(`Error processing request:`, err.message)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
