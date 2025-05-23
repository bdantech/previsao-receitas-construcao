import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
// CORS headers
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
    // Get the Supabase URL and service role key from environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
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
    // Initialize Supabase client with Service Role Key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Authenticate user
    const reqClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    const { data: { user }, error: authError } = await reqClient.auth.getUser();
    if (authError || !user) {
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
    // Get user's company
    const { data: userCompany, error: userCompanyError } = await reqClient.from('user_companies').select('company_id').eq('user_id', user.id).single();
    if (userCompanyError) {
      return new Response(JSON.stringify({
        error: 'Error getting user company'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }
    if (!userCompany) {
      return new Response(JSON.stringify({
        error: 'User not associated with any company'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 403
      });
    }
    // Parse request to get action and data
    const { action, ...data } = await req.json();
    console.log(`Company payment plans action: ${action}`, data);
    const companyId = userCompany.company_id;
    let responseData;
    // Handle different actions
    switch(action){
      case 'getCompanyPaymentPlans':
        {
          // Query payment plans from projects belonging to the company
          const { data: companyProjects, error: projectsError } = await supabase.from('projects').select('id').eq('company_id', companyId);
          if (projectsError) {
            throw new Error(`Error getting company projects: ${projectsError.message}`);
          }
          if (!companyProjects || companyProjects.length === 0) {
            // Return empty array if company has no projects
            responseData = [];
            break;
          }
          const projectIds = companyProjects.map((project)=>project.id);
          // Get payment plans for company projects
          const { data: paymentPlans, error: plansError } = await supabase.from('payment_plan_settings').select(`
            id, 
            dia_cobranca, 
            teto_fundo_reserva,
            anticipation_request_id,
            project_id,
            index_id,
            adjustment_base_date,
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
          `).in('project_id', projectIds);
          if (plansError) {
            throw new Error(`Error getting payment plans: ${plansError.message}`);
          }
          responseData = paymentPlans || [];
          break;
        }
      case 'getPaymentPlanDetails':
        {
          const { paymentPlanId } = data;
          if (!paymentPlanId) {
            throw new Error('Missing payment plan ID');
          }
          // First verify this payment plan belongs to the company
          const { data: planCheck, error: planCheckError } = await supabase.from('payment_plan_settings').select(`
            projects!inner (
              company_id
            )
          `).eq('id', paymentPlanId).single();
          if (planCheckError) {
            throw new Error(`Error checking payment plan: ${planCheckError.message}`);
          }
          if (planCheck.projects.company_id !== companyId) {
            return new Response(JSON.stringify({
              error: 'Unauthorized to access this payment plan'
            }), {
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              },
              status: 403
            });
          }
          // Get payment plan details with installments
          const { data: paymentPlan, error: ppError } = await supabase.from('payment_plan_settings').select(`
            id, 
            dia_cobranca, 
            teto_fundo_reserva,
            anticipation_request_id,
            project_id,
            index_id,
            adjustment_base_date,
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
          `).eq('id', paymentPlanId).single();
          if (ppError) {
            throw new Error(`Error getting payment plan details: ${ppError.message}`);
          }
          responseData = paymentPlan;
          break;
        }
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    return new Response(JSON.stringify(responseData), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error(`Error handling payment plans request:`, error);
    return new Response(JSON.stringify({
      error: error.message || 'An unexpected error occurred'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
