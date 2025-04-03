import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
// CORS configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey || !supabaseServiceKey) {
      throw new Error('Missing environment variables');
    }
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'Authentication required'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 401
      });
    }
    // Initialize Supabase client with user's auth token for auth verification
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    // Service client for admin operations (bypasses RLS)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    // Authenticate user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({
        error: 'Authentication required'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 401
      });
    }
    console.log('User authenticated:', user.id);
    // Verify user is an admin
    const { data: profile, error: profileError } = await supabaseClient.from('profiles').select('role').eq('id', user.id).single();
    if (profileError) {
      console.error('Profile error:', profileError);
      throw profileError;
    }
    if (profile.role !== 'admin') {
      return new Response(JSON.stringify({
        error: 'Admin access required'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 403
      });
    }
    console.log('Admin access verified');
    // Parse request
    const requestData = await req.json();
    const { action, ...data } = requestData;
    // Handle different actions
    switch(action){
      case 'getAllAnticipations':
        {
          return await handleGetAllAnticipations(serviceClient, data, corsHeaders);
        }
      case 'getAnticipationDetails':
        {
          return await handleGetAnticipationDetails(serviceClient, data, corsHeaders);
        }
      case 'updateAnticipationStatus':
        {
          return await handleUpdateAnticipationStatus(serviceClient, data, corsHeaders, user.id);
        }
      case 'getCompanyAnticipations':
        {
          return await handleGetCompanyAnticipations(serviceClient, data, corsHeaders);
        }
      default:
        return new Response(JSON.stringify({
          error: 'Invalid action'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 400
        });
    }
  } catch (error) {
    console.error("Error in admin-anticipations function:", error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
// Handler for getting all anticipation requests with optional filters
async function handleGetAllAnticipations(serviceClient, data, corsHeaders) {
  const { companyId, companySearch, projectId, status, fromDate, toDate, minValorTotal, maxValorTotal, page = 1, pageSize = 20 } = data;
  try {
    console.log('Handling get all anticipations with filters:', {
      companyId,
      companySearch,
      projectId,
      status,
      fromDate,
      toDate,
      minValorTotal,
      maxValorTotal,
      page,
      pageSize
    });
    // Check if we need to look up company ID by name first
    let actualCompanyId = companyId;
    if (companySearch && !companyId) {
      console.log('Searching for company with name:', companySearch);
      // Look up company by name
      const { data: companies, error: companyError } = await serviceClient.from('companies').select('id').ilike('name', `%${companySearch}%`).limit(1);
      if (companyError) {
        console.error('Error searching for company:', companyError);
        throw companyError;
      }
      if (companies && companies.length > 0) {
        actualCompanyId = companies[0].id;
        console.log('Found company ID:', actualCompanyId);
      } else {
        console.log('No company found with search term:', companySearch);
        // Return empty results if no company found with that name
        return new Response(JSON.stringify({
          anticipations: [],
          pagination: {
            total: 0,
            page,
            pageSize,
            totalPages: 0
          }
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      }
    }
    // Build the query with all optional filters
    let query = serviceClient.from('anticipation_requests').select(`
        id,
        company_id,
        project_id,
        valor_total,
        valor_liquido,
        status,
        quantidade_recebiveis,
        created_at,
        updated_at,
        companies:company_id (name, cnpj),
        projects:project_id (name)
      `);
    // Apply filters if provided
    if (actualCompanyId) {
      query = query.eq('company_id', actualCompanyId);
      console.log('Filtering by company ID:', actualCompanyId);
    }
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (fromDate) {
      query = query.gte('created_at', fromDate);
    }
    if (toDate) {
      query = query.lte('created_at', toDate);
    }
    if (minValorTotal) {
      query = query.gte('valor_total', minValorTotal);
    }
    if (maxValorTotal) {
      query = query.lte('valor_total', maxValorTotal);
    }
    // Add pagination
    const offset = (page - 1) * pageSize;
    // Get total count of results (without pagination)
    // Create a new query for counting instead of using structuredClone
    const countQuery = serviceClient.from('anticipation_requests').select('id', {
      count: 'exact',
      head: true
    });
    // Apply the same filters to the count query
    if (actualCompanyId) {
      countQuery.eq('company_id', actualCompanyId);
    }
    if (projectId) {
      countQuery.eq('project_id', projectId);
    }
    if (status && status !== 'all') {
      countQuery.eq('status', status);
    }
    if (fromDate) {
      countQuery.gte('created_at', fromDate);
    }
    if (toDate) {
      countQuery.lte('created_at', toDate);
    }
    if (minValorTotal) {
      countQuery.gte('valor_total', minValorTotal);
    }
    if (maxValorTotal) {
      countQuery.lte('valor_total', maxValorTotal);
    }
    const { count, error: countError } = await countQuery;
    if (countError) {
      console.error('Error getting count:', countError);
      throw countError;
    }
    console.log('Total count:', count);
    // Get paginated results
    const { data: anticipations, error } = await query.order('created_at', {
      ascending: false
    }).range(offset, offset + pageSize - 1);
    if (error) {
      console.error('Error fetching anticipations:', error);
      throw error;
    }
    console.log(`Found ${anticipations.length} anticipations`);
    return new Response(JSON.stringify({
      anticipations,
      pagination: {
        total: count,
        page,
        pageSize,
        totalPages: Math.ceil(count / pageSize)
      }
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error fetching all anticipations:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
}
// Handler for getting detailed information about a specific anticipation
async function handleGetAnticipationDetails(serviceClient, data, corsHeaders) {
  const { anticipationId } = data;
  if (!anticipationId) {
    return new Response(JSON.stringify({
      error: 'Anticipation ID is required'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 400
    });
  }
  try {
    // Get anticipation details
    const { data: anticipation, error: anticipationError } = await serviceClient.from('anticipation_requests').select(`
        *,
        projects:project_id (
          name,
          cnpj
        ),
        companies:company_id (
          name,
          cnpj
        )
      `).eq('id', anticipationId).single();
    if (anticipationError) {
      console.error('Error fetching anticipation details:', anticipationError);
      throw anticipationError;
    }
    // Get associated receivables
    const { data: anticipationReceivables, error: receivablesError } = await serviceClient.from('anticipation_receivables').select(`
        id,
        anticipation_id,
        receivable_id,
        receivables:receivable_id (
          id,
          buyer_name,
          buyer_cpf,
          amount,
          due_date,
          description,
          status
        )
      `).eq('anticipation_id', anticipationId);
    if (receivablesError) {
      console.error('Error fetching anticipation receivables:', receivablesError);
      throw receivablesError;
    }
    // Extract the receivables data for a cleaner response
    const receivables = anticipationReceivables.map((ar)=>ar.receivables);
    return new Response(JSON.stringify({
      anticipation,
      receivables
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error fetching anticipation details:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
}
// Handler for updating the status of an anticipation request
async function handleUpdateAnticipationStatus(serviceClient, data, corsHeaders, adminId) {
  const { anticipationId, newStatus, notes } = data;
  if (!anticipationId || !newStatus) {
    return new Response(JSON.stringify({
      error: 'Anticipation ID and new status are required'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 400
    });
  }
  try {
    // First get the current status and associated data
    const { data: currentAnticipation, error: fetchError } = await serviceClient.from('anticipation_requests').select('status, company_id, valor_total').eq('id', anticipationId).single();
    if (fetchError) {
      console.error('Error fetching current anticipation:', fetchError);
      throw fetchError;
    }
    const currentStatus = currentAnticipation.status;
    // Validate status transition
    if (!isValidStatusTransition(currentStatus, newStatus)) {
      return new Response(JSON.stringify({
        error: `Invalid status transition from ${currentStatus} to ${newStatus}`
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    // If trying to approve, check credit availability
    if (newStatus === 'Aprovada' && currentStatus !== 'Aprovada') {
      console.log('Checking credit availability before approval...');
      // Get the company's credit analysis record
      const { data: creditAnalysis, error: creditAnalysisError } = await serviceClient.from('company_credit_analysis').select('id, credit_limit, consumed_credit').eq('company_id', currentAnticipation.company_id).eq('status', 'Ativa').single();
      if (creditAnalysisError) {
        console.error('Error fetching company credit analysis:', creditAnalysisError);
        throw creditAnalysisError;
      }
      if (!creditAnalysis) {
        console.error('No active credit analysis found for company');
        return new Response(JSON.stringify({
          error: 'Não foi possível aprovar a antecipação: nenhuma análise de crédito ativa encontrada para a empresa.'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200 // Changed from 400 to 200 to ensure client gets the error message
        });
      }
      // Calculate available credit
      const availableCredit = Number(creditAnalysis.credit_limit) - Number(creditAnalysis.consumed_credit);
      const anticipationAmount = Number(currentAnticipation.valor_total);
      console.log(`Credit check: Available: ${availableCredit}, Requested: ${anticipationAmount}`);
      // Check if there's enough available credit
      if (anticipationAmount > availableCredit) {
        console.log('Insufficient credit limit');
        return new Response(JSON.stringify({
          error: 'Limite de crédito insuficiente',
          details: {
            message: 'Não foi possível aprovar a antecipação: limite de crédito disponível insuficiente.',
            availableCredit: availableCredit,
            requestedAmount: anticipationAmount
          }
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200 // Changed from 400 to 200 to ensure client gets the error message
        });
      }
      console.log('Credit check passed, proceeding with approval');
    }
    // Update the anticipation status
    const { data: updatedAnticipation, error: updateError } = await serviceClient.from('anticipation_requests').update({
      status: newStatus
    }).eq('id', anticipationId).select().single();
    if (updateError) {
      console.error('Error updating anticipation status:', updateError);
      throw updateError;
    }
    // If status is changed to "Aprovada", update the company's consumed_credit
    if (newStatus === 'Aprovada' && currentStatus !== 'Aprovada') {
      console.log('Updating company credit consumption...');
      // Get the company's credit analysis record again to ensure we have the latest data
      const { data: creditAnalysis, error: creditAnalysisError } = await serviceClient.from('company_credit_analysis').select('id, consumed_credit').eq('company_id', currentAnticipation.company_id).eq('status', 'Ativa').single();
      if (creditAnalysisError) {
        console.error('Error fetching company credit analysis:', creditAnalysisError);
        throw creditAnalysisError;
      }
      // Calculate new consumed_credit value
      const newConsumedCredit = Number(creditAnalysis.consumed_credit) + Number(currentAnticipation.valor_total);
      console.log(`Updating consumed credit from ${creditAnalysis.consumed_credit} to ${newConsumedCredit}`);
      // Update the consumed_credit value
      const { error: updateCreditError } = await serviceClient.from('company_credit_analysis').update({
        consumed_credit: newConsumedCredit
      }).eq('id', creditAnalysis.id);
      if (updateCreditError) {
        console.error('Error updating company consumed credit:', updateCreditError);
        throw updateCreditError;
      }
      console.log('Company credit consumption updated successfully');
    }
    return new Response(JSON.stringify({
      success: true,
      anticipation: updatedAnticipation
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error updating anticipation status:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
}
// Handler for getting all anticipations for a specific company
async function handleGetCompanyAnticipations(serviceClient, data, corsHeaders) {
  const { companyId, status } = data;
  if (!companyId) {
    return new Response(JSON.stringify({
      error: 'Company ID is required'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 400
    });
  }
  try {
    let query = serviceClient.from('anticipation_requests').select(`
        id,
        valor_total,
        valor_liquido,
        status,
        quantidade_recebiveis,
        created_at,
        updated_at,
        projects:project_id (name)
      `).eq('company_id', companyId).order('created_at', {
      ascending: false
    });
    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    }
    const { data: anticipations, error } = await query;
    if (error) {
      console.error('Error fetching company anticipations:', error);
      throw error;
    }
    return new Response(JSON.stringify({
      anticipations
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error fetching company anticipations:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
}
// Helper function to validate status transitions
function isValidStatusTransition(currentStatus, newStatus) {
  // Status transition rules based on requirements
  switch(currentStatus){
    case 'Solicitada':
      return [
        'Aprovada',
        'Reprovada'
      ].includes(newStatus);
    case 'Aprovada':
      return [
        'Concluída',
        'Reprovada'
      ].includes(newStatus);
    default:
      return false // No transitions allowed from Reprovada or Concluída
      ;
  }
}
