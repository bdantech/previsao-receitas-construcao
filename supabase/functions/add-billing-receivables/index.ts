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

    // Parse request body
    const { receivableIds, installmentId } = await req.json()
    
    // Validate input
    if (!installmentId || !receivableIds || !Array.isArray(receivableIds) || receivableIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid request data. Required: installmentId and receivableIds array' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    console.log(`Processing request to add ${receivableIds.length} receivables to installment ${installmentId}`);
    
    // IMPORTANT: Use service role client (supabase) to verify installment existence
    // This ensures we have the proper permissions to access the table
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

    if (installmentError || !installment) {
      console.error('Error fetching installment:', installmentError);
      return new Response(
        JSON.stringify({ error: `Installment not found: ${installmentId}. Please check that this installment exists in the database.` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      )
    }
    
    console.log(`Found installment with data_vencimento: ${installment.data_vencimento}`);

    // Verify that all receivables exist and belong to the same project
    const { data: receivables, error: receivablesError } = await supabase
      .from('receivables')
      .select('id, amount, due_date, project_id')
      .in('id', receivableIds)

    if (receivablesError) {
      console.error('Error fetching receivables:', receivablesError);
      return new Response(
        JSON.stringify({ error: `Error fetching receivables: ${receivablesError.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }

    if (!receivables || receivables.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid receivables found for the provided IDs' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }
    
    console.log(`Found ${receivables.length} receivables out of ${receivableIds.length} requested`);

    // Check if any receivables are missing
    if (receivables.length !== receivableIds.length) {
      const foundIds = new Set(receivables.map(r => r.id));
      const missingIds = receivableIds.filter(id => !foundIds.has(id));
      console.error(`Missing receivables:`, missingIds);
      return new Response(
        JSON.stringify({ error: `Some receivables do not exist: ${missingIds.join(', ')}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    // Check if all receivables belong to the correct project
    const wrongProjectReceivables = receivables.filter(r => r.project_id !== installment.project_id);
    if (wrongProjectReceivables.length > 0) {
      console.error(`Receivables from wrong project:`, wrongProjectReceivables);
      return new Response(
        JSON.stringify({ error: `Some receivables do not belong to the project: ${wrongProjectReceivables.map(r => r.id).join(', ')}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    // Get the dia_cobranca from the payment plan settings
    const diaCobranca = installment.payment_plan_settings?.dia_cobranca;
    if (!diaCobranca) {
      return new Response(
        JSON.stringify({ error: 'Missing payment plan settings data needed for nova_data_vencimento calculation' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    // Use the installment's data_vencimento for all billing receivables
    const novaDataVencimento = installment.data_vencimento;
    console.log(`Using nova_data_vencimento: ${novaDataVencimento} for all receivables`);

    // MODIFIED: Check if any of the receivables are already linked to this installment
    const { data: existingLinks, error: existingLinksError } = await supabase
      .from('billing_receivables')
      .select('receivable_id')
      .eq('installment_id', installmentId)
      .in('receivable_id', receivableIds);
      
    if (existingLinksError) {
      console.error('Error checking existing links:', existingLinksError);
      // Continue anyway, we'll handle this during insert
    }
    
    // Get a list of receivable IDs that are already linked
    const existingReceivableIds = new Set(existingLinks?.map(link => link.receivable_id) || []);
    console.log(`Found ${existingReceivableIds.size} receivables already linked to this installment`);
    
    // Filter out receivables that are already linked
    const newReceivableIds = receivableIds.filter(id => !existingReceivableIds.has(id));
    console.log(`Adding ${newReceivableIds.length} new receivables to the installment`);
    
    // MODIFIED: Only create new billing receivables for those not already linked
    const newReceivables = receivables.filter(r => newReceivableIds.includes(r.id));
    
    // Create billing receivables array for new receivables only
    const billingReceivables = newReceivables.map(receivable => {
      return {
        installment_id: installmentId,
        receivable_id: receivable.id,
        nova_data_vencimento: novaDataVencimento
      };
    });

    // Only insert new billing receivables if there are any
    let inserted = [];
    if (billingReceivables.length > 0) {
      console.log('Creating new billing receivables:', JSON.stringify(billingReceivables));
      
      // Insert billing receivables
      const { data: insertedData, error: insertError } = await supabase
        .from('billing_receivables')
        .insert(billingReceivables)
        .select('id, installment_id, receivable_id, nova_data_vencimento, created_at');
  
      if (insertError) {
        console.error('Error inserting billing receivables:', insertError);
        return new Response(
          JSON.stringify({ error: `Error inserting billing receivables: ${insertError.message}` }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        )
      }
      
      inserted = insertedData || [];
      console.log('Successfully inserted billing receivables:', inserted);
    } else {
      console.log('No new billing receivables to insert');
    }

    // Calculate total amount of all receivables (existing + new)
    // Get all billing receivables for this installment to calculate the total
    const { data: allBillingReceivables, error: allBrError } = await supabase
      .from('billing_receivables')
      .select(`
        receivable_id,
        receivables (
          amount
        )
      `)
      .eq('installment_id', installmentId);
      
    if (allBrError) {
      console.error('Error getting all billing receivables:', allBrError);
      return new Response(
        JSON.stringify({ error: `Error calculating total amount: ${allBrError.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }
    
    const totalAmount = (allBillingReceivables || []).reduce(
      (sum, item) => sum + parseFloat(item.receivables.amount), 
      0
    );
    
    console.log(`Total amount of all billing receivables: ${totalAmount}`);

    // Update installment with new recebiveis value
    console.log(`Updating installment ${installmentId} with new recebiveis value: ${totalAmount}`);
    const { data: updatedInstallment, error: updateError } = await supabase
      .from('payment_plan_installments')
      .update({ recebiveis: totalAmount })
      .eq('id', installmentId)
      .select('*');

    if (updateError) {
      console.error('Error updating installment with new recebiveis value:', updateError);
      return new Response(
        JSON.stringify({ 
          success: true, 
          warning: `Billing receivables were created but installment update failed: ${updateError.message}`,
          billingReceivables: inserted
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }
    
    console.log('Updated installment:', updatedInstallment);

    // IMPORTANT: Instead of running the calculate_payment_plan_installments function directly, 
    // use a manual update to each installment to prevent deletion and recreation
    try {
      // Get all installments for this payment plan
      const { data: installments, error: installmentsError } = await supabase
        .from('payment_plan_installments')
        .select('*')
        .eq('payment_plan_settings_id', installment.payment_plan_settings_id)
        .order('numero_parcela', { ascending: true });
        
      if (installmentsError) {
        throw new Error(`Error fetching installments: ${installmentsError.message}`);
      }
      
      // Get the teto_fundo_reserva from payment plan settings
      const { data: settings, error: settingsError } = await supabase
        .from('payment_plan_settings')
        .select('teto_fundo_reserva')
        .eq('id', installment.payment_plan_settings_id)
        .single();
        
      if (settingsError) {
        throw new Error(`Error fetching payment plan settings: ${settingsError.message}`);
      }
      
      const tetoFundoReserva = settings.teto_fundo_reserva;
      console.log(`Manually recalculating installments with teto_fundo_reserva: ${tetoFundoReserva}`);
      
      // First get the valor_total from the anticipation request
      const anticipationRequestId = installments[0]?.anticipation_request_id;
      if (!anticipationRequestId) {
        throw new Error('Could not find anticipation request ID');
      }
      
      // Get valor_total from anticipation_requests
      const { data: anticipation, error: anticipationError } = await supabase
        .from('anticipation_requests')
        .select('valor_total')
        .eq('id', anticipationRequestId)
        .single();
        
      if (anticipationError) {
        throw new Error(`Error fetching anticipation request: ${anticipationError.message}`);
      }
      
      let saldoDevedorInitial = anticipation.valor_total || 0;
      console.log(`Starting saldo_devedor: ${saldoDevedorInitial} from anticipation ${anticipationRequestId}`);
      
      // Process installments in order of numero_parcela
      let previousFundoReserva = 0;
      
      // Now update each installment
      for (const inst of installments) {
        if (inst.pmt === null || typeof inst.pmt !== 'number') continue;
        
        const saldoDevedor = inst.numero_parcela === 0 
          ? saldoDevedorInitial - inst.pmt 
          : Math.max(0, installments[installments.findIndex(i => i.id === inst.id) - 1]?.saldo_devedor - inst.pmt);
        
        // First installment (number 0) - special handling
        if (inst.numero_parcela === 0) {
          // Update the installment with new saldo_devedor
          await supabase
            .from('payment_plan_installments')
            .update({ 
              saldo_devedor: saldoDevedor,
              fundo_reserva: 0, // First installment has no fundo_reserva
              devolucao: 0 // First installment has no devolucao
            })
            .eq('id', inst.id);
            
          console.log(`Updated installment ${inst.numero_parcela} (${inst.id}): saldo_devedor=${saldoDevedor}, fundo_reserva=0, devolucao=0`);
        }
        // Other installments
        else {
          // Calculate current installment's contribution to fundo_reserva
          const recebiveis = inst.recebiveis || 0;
          const currentContribution = recebiveis - inst.pmt;
          
          // Calculate new fundo_reserva including previous balance
          let fundoReserva = previousFundoReserva + currentContribution;
          
          // Calculate devolucao if fundo_reserva exceeds teto
          let devolucao = 0;
          if (fundoReserva > tetoFundoReserva) {
            devolucao = fundoReserva - tetoFundoReserva;
            fundoReserva = tetoFundoReserva;
          }
          
          // Update the installment with new values
          await supabase
            .from('payment_plan_installments')
            .update({ 
              saldo_devedor: saldoDevedor,
              fundo_reserva: fundoReserva,
              devolucao: devolucao
            })
            .eq('id', inst.id);
            
          console.log(`Updated installment ${inst.numero_parcela} (${inst.id}): saldo_devedor=${saldoDevedor}, fundo_reserva=${fundoReserva}, devolucao=${devolucao}`);
          
          // Store current fundo_reserva for next iteration
          previousFundoReserva = fundoReserva;
        }
      }
      
      console.log('Manual payment plan recalculation succeeded');
    } catch (calcError) {
      console.error('Error in manual payment plan recalculation:', calcError);
      return new Response(
        JSON.stringify({ 
          success: true, 
          warning: `Billing receivables were created but payment plan recalculation failed: ${calcError.message}`,
          updatedInstallment: updatedInstallment[0],
          billingReceivables: inserted
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Fetch the billing receivables with receiver details for the response
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

    return new Response(
      JSON.stringify({ 
        success: true,
        updatedInstallment: updatedInstallment[0],
        billingReceivables: createdBillingReceivables || inserted
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error(`Error in add-billing-receivables:`, error);
    
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
