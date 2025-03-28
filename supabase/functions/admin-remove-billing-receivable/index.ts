
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

    // Parse request to get parameters
    const { installmentId, billingReceivableId } = await req.json()
    
    if (!installmentId || !billingReceivableId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters (installmentId, billingReceivableId)' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    console.log(`Removing billing receivable ${billingReceivableId} from installment ${installmentId}`);
    
    // Get the billing receivable to verify it belongs to the installment and to get amount
    const { data: billingReceivable, error: brError } = await supabase
      .from('billing_receivables')
      .select(`
        id, 
        receivable_id,
        installment_id,
        receivables (
          amount
        )
      `)
      .eq('id', billingReceivableId)
      .single();

    if (brError) {
      console.error('Error getting billing receivable:', brError);
      return new Response(
        JSON.stringify({ error: `Error getting billing receivable: ${brError.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }

    // Verify that the billing receivable belongs to the specified installment
    if (billingReceivable.installment_id !== installmentId) {
      console.error(`Billing receivable ${billingReceivableId} does not belong to installment ${installmentId}`);
      return new Response(
        JSON.stringify({ error: 'Billing receivable does not belong to the specified installment' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    // Get the amount of the receivable to be removed
    const removedAmount = parseFloat(billingReceivable.receivables.amount);
    console.log(`Removing receivable with amount: ${removedAmount}`);

    // Delete only the specific billing receivable
    const { error: deleteError } = await supabase
      .from('billing_receivables')
      .delete()
      .eq('id', billingReceivableId);

    if (deleteError) {
      console.error('Error removing billing receivable:', deleteError);
      return new Response(
        JSON.stringify({ error: `Error removing billing receivable: ${deleteError.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
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
      return new Response(
        JSON.stringify({ error: `Error getting remaining receivables: ${remainingError.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
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
      return new Response(
        JSON.stringify({ error: `Error getting installment: ${installmentError.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
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
      return new Response(
        JSON.stringify({ error: `Error updating installment: ${updateError.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
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
      return new Response(
        JSON.stringify({ error: `Error recalculating payment plan: ${calcError.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }
    
    console.log('Payment plan recalculation succeeded');

    return new Response(
      JSON.stringify({ 
        success: true,
        removedReceivableId: billingReceivable.receivable_id,
        newTotal: totalAmount,
        updatedInstallment: updatedInstallment ? updatedInstallment[0] : null
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error(`Error handling remove billing receivable request:`, error);
    
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
