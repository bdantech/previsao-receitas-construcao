import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get supabase client with auth context from request
    const authorization = req.headers.get('Authorization')
    if (!authorization) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    })

    // Verify the user is an admin
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify user is an admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      console.error('Admin verification failed:', profileError || 'Not an admin')
      return new Response(JSON.stringify({ error: 'Unauthorized - Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get the request body
    const requestData = await req.json()
    const { action, companyId, analysisId, analysisData } = requestData

    console.log(`Admin credit analysis - Action: ${action}, Company ID: ${companyId}`)

    let result
    let error

    switch (action) {
      case 'list':
        // List all credit analyses or for a specific company
        if (companyId) {
          const { data, error: listError } = await supabase
            .from('company_credit_analysis')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })
          
          result = data
          error = listError
        } else {
          // Join with companies to get company names for easier administration
          const { data, error: listError } = await supabase
            .from('company_credit_analysis')
            .select(`
              id,
              company_id,
              interest_rate_180,
              interest_rate_360,
              interest_rate_720,
              interest_rate_long_term,
              fee_per_receivable,
              credit_limit,
              consumed_credit,
              status,
              created_at,
              updated_at,
              companies:company_id (name, cnpj)
            `)
            .order('created_at', { ascending: false })
          
          result = data
          error = listError
        }
        break

      case 'get':
        // Get a specific credit analysis
        if (!analysisId) {
          return new Response(JSON.stringify({ error: 'Missing analysis ID' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const { data: getResult, error: getError } = await supabase
          .from('company_credit_analysis')
          .select(`
            id,
            company_id,
            interest_rate_180,
            interest_rate_360,
            interest_rate_720,
            interest_rate_long_term,
            fee_per_receivable,
            credit_limit,
            consumed_credit,
            status,
            created_at,
            updated_at,
            companies:company_id (name, cnpj)
          `)
          .eq('id', analysisId)
          .single()
        
        result = getResult
        error = getError
        break

      case 'create':
        // Create a new credit analysis
        if (!companyId || !analysisData) {
          return new Response(JSON.stringify({ error: 'Missing required data' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        try {
          // If status is Ativa, check if there's already an active analysis and update it
          if (analysisData.status === 'Ativa') {
            // Find existing active analyses using a direct query without joins
            const { data: existingActive, error: findError } = await supabase
              .from('company_credit_analysis')
              .select('id')
              .filter('company_id', 'eq', companyId)
              .filter('status', 'eq', 'Ativa')
              .limit(1)
            
            if (findError) {
              console.error('Error finding existing active analyses:', findError)
              throw findError
            }

            // Update existing active analyses to inactive
            if (existingActive && existingActive.length > 0) {
              const { error: updateError } = await supabase
                .from('company_credit_analysis')
                .update({ status: 'Inativa' })
                .eq('id', existingActive[0].id)
              
              if (updateError) {
                console.error('Error updating existing active analysis:', updateError)
                throw updateError
              }
            }
          }

          // Insert the new credit analysis using a direct fetch to the REST API
          const apiUrl = `${supabaseUrl}/rest/v1/company_credit_analysis`;
          const insertResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({
              company_id: companyId,
              interest_rate_180: analysisData.interest_rate_180,
              interest_rate_360: analysisData.interest_rate_360,
              interest_rate_720: analysisData.interest_rate_720,
              interest_rate_long_term: analysisData.interest_rate_long_term,
              fee_per_receivable: analysisData.fee_per_receivable,
              credit_limit: analysisData.credit_limit,
              consumed_credit: analysisData.consumed_credit || 0,
              status: analysisData.status
            })
          });

          if (!insertResponse.ok) {
            const errorData = await insertResponse.json();
            console.error('Error inserting new credit analysis:', errorData);
            throw new Error(`Failed to create credit analysis: ${insertResponse.statusText}`);
          }

          const insertResult = await insertResponse.json();
          
          if (!insertResult || insertResult.length === 0) {
            console.error('No data returned from insert operation');
            throw new Error('Failed to create credit analysis');
          }

          result = insertResult[0];
        } catch (err) {
          error = err
        }
        break

      case 'update':
        // Update an existing credit analysis
        if (!analysisId || !analysisData) {
          return new Response(JSON.stringify({ error: 'Missing required data' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        try {
          // Get the company_id for the analysis we're updating
          const { data: currentAnalysis, error: getError } = await supabase
            .from('company_credit_analysis')
            .select('company_id, status')
            .eq('id', analysisId)
            .single()
          
          if (getError) {
            console.error('Error getting current analysis:', getError)
            throw getError
          }

          if (!currentAnalysis) {
            throw new Error('Analysis not found')
          }

          // If changing to Ativa, check if there's already another active analysis
          if (analysisData.status === 'Ativa') {
            // Find existing active analyses using a direct query without joins
            const { data: existingActive, error: findError } = await supabase
              .from('company_credit_analysis')
              .select('id')
              .filter('company_id', 'eq', currentAnalysis.company_id)
              .filter('status', 'eq', 'Ativa')
              .neq('id', analysisId) // Exclude the current analysis
              .limit(1)
            
            if (findError) {
              console.error('Error finding existing active analyses:', findError)
              throw findError
            }

            // Update existing active analyses to inactive
            if (existingActive && existingActive.length > 0) {
              const { error: updateError } = await supabase
                .from('company_credit_analysis')
                .update({ status: 'Inativa' })
                .eq('id', existingActive[0].id)
              
              if (updateError) {
                console.error('Error updating existing active analysis:', updateError)
                throw updateError
              }
            }
          }

          // Update the credit analysis
          const { data: updateResult, error: updateError } = await supabase
            .from('company_credit_analysis')
            .update({
              interest_rate_180: analysisData.interest_rate_180,
              interest_rate_360: analysisData.interest_rate_360,
              interest_rate_720: analysisData.interest_rate_720,
              interest_rate_long_term: analysisData.interest_rate_long_term,
              fee_per_receivable: analysisData.fee_per_receivable,
              credit_limit: analysisData.credit_limit,
              consumed_credit: analysisData.consumed_credit,
              status: analysisData.status
            })
            .eq('id', analysisId)
            .select('*')
            .single()
          
          if (updateError) {
            console.error('Error updating credit analysis:', updateError)
            throw updateError
          }
          
          result = updateResult
        } catch (err) {
          error = err
        }
        break

      case 'delete':
        // Delete a credit analysis
        if (!analysisId) {
          return new Response(JSON.stringify({ error: 'Missing analysis ID' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const { data: deleteResult, error: deleteError } = await supabase
          .from('company_credit_analysis')
          .delete()
          .eq('id', analysisId)
          .select(`
            id,
            company_id,
            interest_rate_180,
            interest_rate_360,
            interest_rate_720,
            interest_rate_long_term,
            fee_per_receivable,
            credit_limit,
            consumed_credit,
            status,
            created_at,
            updated_at
          `)
        
        result = deleteResult
        error = deleteError
        break

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    if (error) {
      console.error(`Error in ${action} operation:`, error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
