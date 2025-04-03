import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey || !supabaseServiceKey) {
      throw new Error('Missing environment variables');
    }
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
    const requestData = await req.json();
    const { action, companyId, projectId, buyerId, buyerData, filters } = requestData;
    console.log('requestData', requestData);
    console.log('Admin project buyers request:', action, companyId, projectId, buyerId);
    // Initialize the admin client with service role key
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    // Create a client with the user's token for authentication
    const userClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    // Get user from the token using the user's client
    const { data: { user }, error: authError } = await userClient.auth.getUser();
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
    // Get user's role from profiles using the service client
    const { data: profile, error: profileError } = await serviceClient.from('profiles').select('role').eq('id', user.id).single();
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
    console.log('Admin user verified:', user.id);
    if (action === 'list') {
      let baseQuery = serviceClient.from('project_buyers').select(`
          *,
          projects:project_id (
            name,
            company_id,
            companies:company_id (
              id,
              name
            )
          )
        `).order('created_at', {
        ascending: false
      });
      if (companyId) {
        const { data, error } = await baseQuery.eq('projects.company_id', companyId);
        if (error) {
          console.error('Project buyers query error:', error);
          throw error;
        }
        const transformedBuyers = data.map((buyer)=>({
            ...buyer,
            project_name: buyer.projects?.name || '',
            company_name: buyer.projects?.companies?.name || '',
            company_id: buyer.projects?.companies?.id || ''
          }));
        return new Response(JSON.stringify({
          buyers: transformedBuyers
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      } else {
        const { data, error } = await baseQuery;
        if (error) {
          console.error('Project buyers query error:', error);
          throw error;
        }
        const transformedBuyers = data.map((buyer)=>({
            ...buyer,
            project_name: buyer.projects?.name || '',
            company_name: buyer.projects?.companies?.name || '',
            company_id: buyer.projects?.companies?.id || ''
          }));
        return new Response(JSON.stringify({
          buyers: transformedBuyers
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      }
    }
    if (action === 'get' && buyerId) {
      const query = `
        SELECT 
          pb.*,
          p.name as project_name,
          c.name as company_name,
          c.id as company_id
        FROM 
          project_buyers pb
        JOIN 
          projects p ON pb.project_id = p.id
        JOIN 
          companies c ON p.company_id = c.id
        WHERE 
          pb.id = $1
      `;
      const { data: result, error: buyerError } = await serviceClient.rpc('execute_sql', {
        params: [
          buyerId
        ],
        query_text: query
      });
      console.log('Single buyer RPC result:', {
        data: result,
        error: buyerError
      });
      if (buyerError) {
        console.error('Project buyer fetch error:', buyerError);
        return new Response(JSON.stringify({
          error: 'Failed to fetch buyer',
          details: buyerError
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 500
        });
      }
      if (result?.error) {
        console.error('SQL execution error:', result);
        return new Response(JSON.stringify({
          error: 'SQL execution failed',
          details: result.error
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 500
        });
      }
      const buyers = Array.isArray(result) ? result : [];
      if (!buyers.length) {
        return new Response(JSON.stringify({
          error: 'Project buyer not found'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 404
        });
      }
      const buyer = buyers[0];
      return new Response(JSON.stringify({
        buyer
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
    if (action === 'update' && buyerId && buyerData) {
      console.log('Admin updating project buyer with data:', buyerData);
      // Validate required fields
      if (!companyId || !projectId) {
        return new Response(JSON.stringify({
          error: 'Missing required fields: companyId and projectId are required'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 400
        });
      }
      // Validate contract_status if it's being updated
      if (buyerData.contract_status) {
        const validContractStatuses = [
          'aprovado',
          'reprovado',
          'a_enviar',
          'a_analisar'
        ];
        if (!validContractStatuses.includes(buyerData.contract_status)) {
          return new Response(JSON.stringify({
            error: 'Invalid contract_status value',
            validValues: validContractStatuses
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            },
            status: 400
          });
        }
      }
      // Validate credit_analysis_status if it's being updated
      if (buyerData.credit_analysis_status) {
        const validCreditStatuses = [
          'aprovado',
          'reprovado',
          'a_analisar'
        ];
        if (!validCreditStatuses.includes(buyerData.credit_analysis_status)) {
          return new Response(JSON.stringify({
            error: 'Invalid credit_analysis_status value',
            validValues: validCreditStatuses
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            },
            status: 400
          });
        }
      }
      // Verify the buyer belongs to the specified company and project
      const { data: buyer, error: buyerError } = await serviceClient.from('project_buyers').select('project_id, projects!inner(company_id)').eq('id', buyerId).single();
      if (buyerError || !buyer) {
        console.error('Error fetching buyer:', buyerError);
        return new Response(JSON.stringify({
          error: 'Buyer not found'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 404
        });
      }
      if (buyer.project_id !== projectId || buyer.projects.company_id !== companyId) {
        return new Response(JSON.stringify({
          error: 'Buyer does not belong to the specified company and project'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 403
        });
      }
      // Update the buyer
      const { data: updatedBuyer, error: updateError } = await serviceClient.from('project_buyers').update(buyerData).eq('id', buyerId).select().single();
      if (updateError) {
        console.error('Project buyer update error:', updateError);
        throw updateError;
      }
      return new Response(JSON.stringify({
        buyer: updatedBuyer
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
    return new Response(JSON.stringify({
      error: 'Invalid action or missing parameters'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 400
    });
  } catch (error) {
    console.error("Error in admin-project-buyers function:", error);
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
