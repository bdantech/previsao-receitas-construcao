import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    // Get supabase client with auth context from request
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      return new Response(JSON.stringify({
        error: 'Missing authorization header'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: authorization
        }
      },
      auth: {
        persistSession: false
      }
    });
    // Verify the user is an admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Not authenticated'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Verify user is an admin
    const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profileError || profile?.role !== 'admin') {
      console.error('Admin verification failed:', profileError || 'Not an admin');
      return new Response(JSON.stringify({
        error: 'Unauthorized - Admin access required'
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get the request body
    const requestData = await req.json();
    const { action, companyId, analysisId, analysisData } = requestData;
    console.log(`Admin credit analysis - Action: ${action}, Company ID: ${companyId}`);
    let result;
    let error;
    switch(action){
      case 'list':
        // List all credit analyses or for a specific company
        try {
          if (companyId) {
            // List analyses for a specific company using direct REST API
            const apiUrl = `${supabaseUrl}/rest/v1/company_credit_analysis?company_id=eq.${companyId}&order=created_at.desc`;
            const listResponse = await fetch(apiUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
              }
            });
            if (!listResponse.ok) {
              const errorData = await listResponse.json();
              console.error('Error listing credit analyses for company:', errorData);
              throw new Error(`Failed to list credit analyses: ${listResponse.statusText}`);
            }
            const listResult = await listResponse.json();
            result = listResult;
          } else {
            // List all analyses with company information using direct REST API
            // First get all credit analyses
            const apiUrl = `${supabaseUrl}/rest/v1/company_credit_analysis?order=created_at.desc`;
            const listResponse = await fetch(apiUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
              }
            });
            if (!listResponse.ok) {
              const errorData = await listResponse.json();
              console.error('Error listing all credit analyses:', errorData);
              throw new Error(`Failed to list credit analyses: ${listResponse.statusText}`);
            }
            const analyses = await listResponse.json();
            // Then get company information for each analysis
            const analysesWithCompanies = await Promise.all(analyses.map(async (analysis)=>{
              const companyUrl = `${supabaseUrl}/rest/v1/companies?id=eq.${analysis.company_id}&select=name,cnpj`;
              const companyResponse = await fetch(companyUrl, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`
                }
              });
              if (companyResponse.ok) {
                const companies = await companyResponse.json();
                if (companies && companies.length > 0) {
                  return {
                    ...analysis,
                    companies: companies[0]
                  };
                }
              }
              return analysis;
            }));
            result = analysesWithCompanies;
          }
        } catch (err) {
          error = err;
        }
        break;
      case 'get':
        // Get a specific credit analysis
        if (!analysisId) {
          return new Response(JSON.stringify({
            error: 'Missing analysis ID'
          }), {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
        try {
          // Get the credit analysis using direct REST API
          const apiUrl = `${supabaseUrl}/rest/v1/company_credit_analysis?id=eq.${analysisId}`;
          const getResponse = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            }
          });
          if (!getResponse.ok) {
            const errorData = await getResponse.json();
            console.error('Error getting credit analysis:', errorData);
            throw new Error(`Failed to get credit analysis: ${getResponse.statusText}`);
          }
          const analyses = await getResponse.json();
          if (!analyses || analyses.length === 0) {
            throw new Error('Credit analysis not found');
          }
          const analysis = analyses[0];
          // Get company information
          const companyUrl = `${supabaseUrl}/rest/v1/companies?id=eq.${analysis.company_id}&select=name,cnpj`;
          const companyResponse = await fetch(companyUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            }
          });
          if (companyResponse.ok) {
            const companies = await companyResponse.json();
            if (companies && companies.length > 0) {
              result = {
                ...analysis,
                companies: companies[0]
              };
            } else {
              result = analysis;
            }
          } else {
            result = analysis;
          }
        } catch (err) {
          error = err;
        }
        break;
      case 'create':
        // Create a new credit analysis
        if (!companyId || !analysisData) {
          return new Response(JSON.stringify({
            error: 'Missing required data'
          }), {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
        try {
          // If status is Ativa, check if there's already an active analysis and update it
          if (analysisData.status === 'Ativa') {
            // Find existing active analyses using a direct query without joins
            const { data: existingActive, error: findError } = await supabase.from('company_credit_analysis').select('id').filter('company_id', 'eq', companyId).filter('status', 'eq', 'Ativa').limit(1);
            if (findError) {
              console.error('Error finding existing active analyses:', findError);
              throw findError;
            }
            // Update existing active analyses to inactive
            if (existingActive && existingActive.length > 0) {
              const { error: updateError } = await supabase.from('company_credit_analysis').update({
                status: 'Inativa'
              }).eq('id', existingActive[0].id);
              if (updateError) {
                console.error('Error updating existing active analysis:', updateError);
                throw updateError;
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
          error = err;
        }
        break;
      case 'update':
        // Update an existing credit analysis
        if (!analysisId || !analysisData) {
          return new Response(JSON.stringify({
            error: 'Missing required data'
          }), {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
        try {
          // Get the company_id for the analysis we're updating using direct REST API
          const getApiUrl = `${supabaseUrl}/rest/v1/company_credit_analysis?id=eq.${analysisId}&select=company_id,status`;
          const getResponse = await fetch(getApiUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            }
          });
          if (!getResponse.ok) {
            const errorData = await getResponse.json();
            console.error('Error getting current analysis:', errorData);
            throw new Error(`Failed to get current analysis: ${getResponse.statusText}`);
          }
          const currentAnalyses = await getResponse.json();
          if (!currentAnalyses || currentAnalyses.length === 0) {
            throw new Error('Analysis not found');
          }
          const currentAnalysis = currentAnalyses[0];
          console.log('Current analysis:', currentAnalysis);
          // If changing to Ativa, check if there's already another active analysis
          if (analysisData.status === 'Ativa') {
            // Find existing active analyses using direct REST API
            const activeApiUrl = `${supabaseUrl}/rest/v1/company_credit_analysis?company_id=eq.${currentAnalysis.company_id}&status=eq.Ativa&id=neq.${analysisId}&select=id`;
            const activeResponse = await fetch(activeApiUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
              }
            });
            if (!activeResponse.ok) {
              const errorData = await activeResponse.json();
              console.error('Error finding existing active analyses:', errorData);
              throw new Error(`Failed to find existing active analyses: ${activeResponse.statusText}`);
            }
            const existingActive = await activeResponse.json();
            console.log('Existing active analyses:', existingActive);
            // Update existing active analyses to inactive
            if (existingActive && existingActive.length > 0) {
              for (const active of existingActive){
                const inactiveApiUrl = `${supabaseUrl}/rest/v1/company_credit_analysis?id=eq.${active.id}`;
                const inactiveResponse = await fetch(inactiveApiUrl, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Prefer': 'return=minimal'
                  },
                  body: JSON.stringify({
                    status: 'Inativa'
                  })
                });
                if (!inactiveResponse.ok) {
                  const errorData = await inactiveResponse.json();
                  console.error('Error updating existing active analysis:', errorData);
                  throw new Error(`Failed to update existing active analysis: ${inactiveResponse.statusText}`);
                }
              }
            }
          }
          // Update the credit analysis using a direct fetch to the REST API
          const apiUrl = `${supabaseUrl}/rest/v1/company_credit_analysis?id=eq.${analysisId}`;
          const updateResponse = await fetch(apiUrl, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({
              interest_rate_180: analysisData.interest_rate_180,
              interest_rate_360: analysisData.interest_rate_360,
              interest_rate_720: analysisData.interest_rate_720,
              interest_rate_long_term: analysisData.interest_rate_long_term,
              fee_per_receivable: analysisData.fee_per_receivable,
              credit_limit: analysisData.credit_limit,
              consumed_credit: analysisData.consumed_credit,
              status: analysisData.status
            })
          });
          if (!updateResponse.ok) {
            const errorData = await updateResponse.json();
            console.error('Error updating credit analysis:', errorData);
            throw new Error(`Failed to update credit analysis: ${updateResponse.statusText}`);
          }
          const updateResult = await updateResponse.json();
          if (!updateResult || updateResult.length === 0) {
            console.error('No data returned from update operation');
            throw new Error('Failed to update credit analysis');
          }
          result = updateResult[0];
        } catch (err) {
          error = err;
        }
        break;
      case 'delete':
        // Delete a credit analysis
        if (!analysisId) {
          return new Response(JSON.stringify({
            error: 'Missing analysis ID'
          }), {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
        try {
          // Delete the credit analysis using a direct fetch to the REST API
          const apiUrl = `${supabaseUrl}/rest/v1/company_credit_analysis?id=eq.${analysisId}`;
          const deleteResponse = await fetch(apiUrl, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Prefer': 'return=representation'
            }
          });
          if (!deleteResponse.ok) {
            const errorData = await deleteResponse.json();
            console.error('Error deleting credit analysis:', errorData);
            throw new Error(`Failed to delete credit analysis: ${deleteResponse.statusText}`);
          }
          const deleteResult = await deleteResponse.json();
          if (!deleteResult || deleteResult.length === 0) {
            console.error('No data returned from delete operation');
            throw new Error('Failed to delete credit analysis');
          }
          result = deleteResult[0];
        } catch (err) {
          error = err;
        }
        break;
      default:
        return new Response(JSON.stringify({
          error: 'Invalid action'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
    }
    if (error) {
      console.error(`Error in ${action} operation:`, error);
      return new Response(JSON.stringify({
        error: error.message
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
