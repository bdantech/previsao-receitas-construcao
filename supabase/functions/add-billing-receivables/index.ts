
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
    
    // Get installment details to determine the date constraints and project_id
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
        JSON.stringify({ error: `Installment not found: ${installmentId}` }),
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

    // Clear existing billing receivables for this installment
    console.log(`Deleting existing billing receivables for installment ${installmentId}`);
    const { error: deleteError } = await supabase
      .from('billing_receivables')
      .delete()
      .eq('installment_id', installmentId);

    if (deleteError) {
      console.error('Error deleting existing billing receivables:', deleteError);
      return new Response(
        JSON.stringify({ error: `Error deleting existing billing receivables: ${deleteError.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }
    
    console.log(`Successfully deleted existing billing receivables for installment ${installmentId}`);

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

    // Create billing receivables array
    const billingReceivables = receivables.map(receivable => {
      return {
        installment_id: installmentId,
        receivable_id: receivable.id,
        nova_data_vencimento: novaDataVencimento
      };
    });

    // Log the receivables we're creating for debugging
    console.log('Creating billing receivables:', JSON.stringify(billingReceivables));

    // Insert billing receivables
    const { data: inserted, error: insertError } = await supabase
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

    console.log('Successfully inserted billing receivables:', inserted);
    
    // Verify the insertion succeeded by querying for the inserted records
    const { data: verificationData, error: verificationError } = await supabase
      .from('billing_receivables')
      .select('id, receivable_id, nova_data_vencimento')
      .eq('installment_id', installmentId);
    
    if (verificationError) {
      console.error('Error verifying billing receivables insertion:', verificationError);
      // Continue anyway since we have the insertion data
    } else {
      console.log(`Verification found ${verificationData?.length || 0} billing receivables for installment ${installmentId}`);
      if (verificationData?.length !== receivableIds.length) {
        console.warn(`Mismatch in count: expected ${receivableIds.length}, found ${verificationData?.length}`);
      }
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

    // Recalculate payment plan
    console.log(`Recalculating payment plan for settings_id ${installment.payment_plan_settings_id}`);
    const { error: calcError } = await supabase.rpc(
      'calculate_payment_plan_installments',
      { p_payment_plan_settings_id: installment.payment_plan_settings_id }
    );

    if (calcError) {
      console.error('Error recalculating payment plan:', calcError);
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
    
    console.log('Payment plan recalculation succeeded');

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
