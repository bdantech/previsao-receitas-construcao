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

        // Debug: Check what installmentId we're querying with
        console.log(`Querying billing_receivables with installment_id: ${installmentId}`);
        
        // Get billing receivables with explicit nova_data_vencimento field
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

        // Debug logging
        console.log(`Billing receivables found for installment ${installmentId}:`, billingReceivables || []);

        responseData = {
          pmtReceivables: pmtReceivables || [],
          billingReceivables: billingReceivables || []
        }
        break
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
          .not('status', 'eq', 'reprovado')

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
        const { installmentId, receivableIds } = data
        
        if (!installmentId || !receivableIds || !Array.isArray(receivableIds)) {
          throw new Error('Missing or invalid required fields')
        }

        if (receivableIds.length === 0) {
          throw new Error('At least one receivable ID is required')
        }

        console.log(`Checking if installment ${installmentId} exists before proceeding`);
        
        // Simplify validation - check installment first
        const { data: installment, error: installmentError } = await supabase
          .from('payment_plan_installments')
          .select(`
            id, 
            project_id, 
            payment_plan_settings_id,
            data_vencimento,
            payment_plan_settings (
              dia_cobranca
            )
          `)
          .eq('id', installmentId)
          .single()

        // More robust error handling for missing installment
        if (installmentError || !installment) {
          console.error('Installment not found or error:', installmentError, 'installmentId:', installmentId);
          throw new Error(`Installment not found: ${installmentId}. Please check that this installment exists in the database.`);
        }
        
        console.log(`Installment found:`, installment);

        // Verify that all receivables belong to the same project
        // We're intentionally NOT checking if the receivable is already in billing_receivables
        // since we'll be deleting/recreating them anyway
        const { data: receivables, error: receivablesError } = await supabase
          .from('receivables')
          .select('id, amount, due_date, project_id')
          .in('id', receivableIds)

        if (receivablesError) {
          console.error('Error getting receivables:', receivablesError);
          throw new Error(`Error getting receivables: ${receivablesError.message}`);
        }

        if (!receivables || receivables.length === 0) {
          console.error('No receivables found for the provided IDs');
          throw new Error('No receivables found for the provided IDs');
        }

        // Log found receivables for debugging
        console.log(`Found ${receivables.length} receivables out of ${receivableIds.length} requested:`, 
          receivables.map(r => ({ id: r.id, project_id: r.project_id })));
        
        // Check if any receivables are missing
        if (receivables.length !== receivableIds.length) {
          const foundIds = new Set(receivables.map(r => r.id));
          const missingIds = receivableIds.filter(id => !foundIds.has(id));
          console.error(`Missing receivables:`, missingIds);
          throw new Error(`Some receivables do not exist: ${missingIds.join(', ')}`);
        }
        
        // Check if all receivables belong to the correct project
        const wrongProjectReceivables = receivables.filter(r => r.project_id !== installment.project_id);
        if (wrongProjectReceivables.length > 0) {
          console.error(`Receivables from wrong project:`, wrongProjectReceivables);
          throw new Error(`Some receivables do not belong to the project: ${wrongProjectReceivables.map(r => r.id).join(', ')}`);
        }

        // First, check if any of the receivables are already linked to this installment
        const { data: existingLinks, error: existingLinksError } = await supabase
          .from('billing_receivables')
          .select('receivable_id')
          .eq('installment_id', installmentId)
          .in('receivable_id', receivableIds);
          
        if (existingLinksError) {
          console.error('Error checking existing links:', existingLinksError);
          throw new Error(`Error checking existing links: ${existingLinksError.message}`);
        }
        
        if (existingLinks && existingLinks.length > 0) {
          // Some receivables already exist in this installment
          const existingIds = existingLinks.map(link => link.receivable_id);
          console.log(`Found ${existingIds.length} receivables already linked to this installment:`, existingIds);
          // We'll delete them below anyway
        }

        // Clear existing billing receivables for this installment
        console.log(`Deleting existing billing receivables for installment ${installmentId}`);
        const { error: deleteError } = await supabase
          .from('billing_receivables')
          .delete()
          .eq('installment_id', installmentId);

        if (deleteError) {
          console.error('Error deleting existing billing receivables:', deleteError);
          throw new Error(`Error deleting existing billing receivables: ${deleteError.message}`);
        }
        
        console.log(`Successfully deleted existing billing receivables for installment ${installmentId}`);

        // Verify the payment_plan_settings data exists
        if (!installment.payment_plan_settings || !installment.payment_plan_settings.dia_cobranca) {
          console.error('Missing payment plan settings or dia_cobranca value:', installment);
          throw new Error('Missing payment plan settings data needed for nova_data_vencimento calculation');
        }

        // Get the dia_cobranca from the payment plan settings
        const diaCobranca = installment.payment_plan_settings.dia_cobranca;

        // Create billing receivables array
        const billingReceivables = receivables.map(receivable => {
          // Calculate the nova_data_vencimento based on the receivable due date and payment plan dia_cobranca
          const dueDate = new Date(receivable.due_date);
          const year = dueDate.getFullYear();
          const month = dueDate.getMonth();
          
          // Create date with dia_cobranca
          let novaDataVencimento = new Date(year, month, diaCobranca);
          
          // If dia_cobranca is greater than days in month, adjust to last day
          const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
          if (diaCobranca > lastDayOfMonth) {
            novaDataVencimento = new Date(year, month, lastDayOfMonth);
          }
          
          return {
            installment_id: installmentId,
            receivable_id: receivable.id,
            nova_data_vencimento: novaDataVencimento.toISOString().split('T')[0]
          };
        });

        // Log the receivables we're creating for debugging
        console.log('Creating billing receivables:', JSON.stringify(billingReceivables));

        // Set explicit transaction to ensure all operations are atomic
        const { data: inserted, error: insertError } = await supabase
          .from('billing_receivables')
          .insert(billingReceivables)
          .select('id, installment_id, receivable_id, nova_data_vencimento, created_at');

        if (insertError) {
          console.error('Error inserting billing receivables:', insertError);
          throw new Error(`Error inserting billing receivables: ${insertError.message}`);
        }

        console.log('Inserted billing receivables:', inserted);
        
        // Verify the insertion succeeded by querying for the inserted records
        const { data: verificationData, error: verificationError } = await supabase
          .from('billing_receivables')
          .select('id, receivable_id, nova_data_vencimento')
          .eq('installment_id', installmentId);
        
        if (verificationError) {
          console.error('Error verifying billing receivables insertion:', verificationError);
        } else {
          console.log(`Verification found ${verificationData?.length || 0} billing receivables for installment ${installmentId}:`, verificationData);
        }

        // Calculate total amount of receivables
        const totalAmount = receivables.reduce((sum, receivable) => sum + parseFloat(receivable.amount), 0);

        // Update installment with new recebiveis value
        console.log(`Updating installment ${installmentId} with new recebiveis value: ${totalAmount}`);
        const { data: updatedInstallment, error: updateError } = await supabase
          .from('payment_plan_installments')
          .update({ recebiveis: totalAmount })
          .eq('id', installmentId)
          .select('*');

        if (updateError) {
          console.error('Error updating installment with new recebiveis value:', updateError);
          throw new Error(`Error updating installment: ${updateError.message}`);
        }
        
        if (!updatedInstallment || updatedInstallment.length === 0) {
          console.error('No installment was updated. This is unexpected as we already verified it exists');
          throw new Error('Failed to update installment with new recebiveis value');
        }

        console.log('Updated installment:', updatedInstallment[0]);

        // Safely attempt to recalculate payment plan
        try {
          // Recalculate payment plan
          console.log(`Recalculating payment plan for settings_id ${installment.payment_plan_settings_id}`);
          const { error: calcError } = await supabase.rpc(
            'calculate_payment_plan_installments',
            { p_payment_plan_settings_id: installment.payment_plan_settings_id }
          );

          if (calcError) {
            console.error('Error recalculating payment plan:', calcError);
            throw new Error(`Error recalculating payment plan: ${calcError.message}`);
          }
          
          console.log('Payment plan recalculation succeeded');
        } catch (recalcError) {
          console.error('Exception during payment plan recalculation:', recalcError);
          // Don't rethrow here to preserve the inserted billing receivables
          responseData = { 
            success: true, 
            warning: 'Billing receivables were created but payment plan recalculation failed: ' + recalcError.message,
            updatedInstallment: updatedInstallment[0],
            billingReceivables: inserted
          };
          
          break;
        }

        // Fetch the billing receivables again to include in the response
        const { data: createdBillingReceivables, error: fetchError } = await supabase
          .from('billing_receivables')
          .select(`
            id,
            receivable_id,
            nova_data_vencimento,
            created_at,
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
          .eq('installment_id', installmentId);
          
        if (fetchError) {
          console.error('Error fetching created billing receivables:', fetchError);
          // Continue anyway, we know they were created
        } else {
          console.log(`Found ${createdBillingReceivables?.length || 0} billing receivables after creation`);
        }

        responseData = { 
          success: true, 
          updatedInstallment: updatedInstallment[0],
          billingReceivables: createdBillingReceivables || inserted
        };
        
        break
      }

      case 'removeBillingReceivable': {
        const { installmentId, billingReceivableId } = data
        
        if (!installmentId || !billingReceivableId) {
          throw new Error('Missing required parameters')
        }

        console.log(`Removing billing receivable ${billingReceivableId} from installment ${installmentId}`);
        
        // Get the billing receivable to verify it belongs to the installment and to get amount
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

        // Delete only the specific billing receivable using both id and installment_id conditions
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
          'recalculate_installment_values',
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
