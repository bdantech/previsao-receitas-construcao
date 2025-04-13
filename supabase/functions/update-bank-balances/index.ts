import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sign } from "./ecdsa.ts";

// CORS headers configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    // Get Supabase credentials from environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    // Initialize Supabase clients
    const supabase = createClient(supabaseUrl, supabaseKey);
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all bank accounts
    const { data: bankAccounts, error: bankAccountsError } = await adminSupabase
      .from('bank_accounts')
      .select('*');

    if (bankAccountsError) {
      throw new Error(`Error fetching bank accounts: ${bankAccountsError.message}`);
    }

    // Process each bank account
    for (const account of bankAccounts) {
      try {
        if (!account.private_key || !account.bank_project_id) {
          console.error(`Missing credentials for account ${account.id}`);
          continue;
        }

        // Authenticate with Starkbank
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const accessId = `project/${account.bank_project_id}`;
        const message = `${accessId}:${timestamp}:`;  // Empty body for GET request
        const signature = await sign(message, account.private_key);

        console.log(`Making request to Starkbank for account ${account.id}`);
        console.log('Request details:', {
          url: 'https://sandbox.api.starkbank.com/v2/balance',
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Access-Id': accessId,
            'Access-Time': timestamp,
            'Access-Signature': signature
          }
        });

        // Get balance from Starkbank
        const response = await fetch('https://sandbox.api.starkbank.com/v2/balance', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Access-Id': accessId,
            'Access-Time': timestamp,
            'Access-Signature': signature,
            'User-Agent': 'Mozilla/5.0'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Starkbank API error for account ${account.id}:`, {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          });
          throw new Error(`Failed to get balance for account ${account.id}: ${response.statusText} - ${errorText}`);
        }

        const balanceData = await response.json();
        console.log(`Received balance data for account ${account.id}:`, balanceData);

        // Get the balance amount from the first item in the balances array and convert from cents to actual value
        const balanceAmount = balanceData.balances[0]?.amount;
        if (balanceAmount === undefined) {
          throw new Error(`No balance data found for account ${account.id}`);
        }

        // Convert from cents to actual value by dividing by 100
        const formattedBalance = balanceAmount / 100;

        // Update bank account balance in our database
        const { error: updateError } = await adminSupabase
          .from('bank_accounts')
          .update({ balance: formattedBalance })
          .eq('id', account.id);

        if (updateError) {
          throw new Error(`Failed to update balance for account ${account.id}: ${updateError.message}`);
        }

        console.log(`Successfully updated balance for account ${account.id} to ${formattedBalance}`);
      } catch (error) {
        console.error(`Error processing account ${account.id}:`, error);
        // Continue with next account even if one fails
        continue;
      }
    }

    return new Response(
      JSON.stringify({ message: 'Bank balances updated successfully' }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      }
    );
  }
});