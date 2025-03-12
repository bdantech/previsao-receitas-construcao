import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey || !supabaseServiceKey) {
      throw new Error('Missing environment variables')
    }

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

    const requestData = await req.json()
    const { 
      action, 
      companyId, 
      projectId, 
      buyerId, 
      buyerData,
      filters
    } = requestData

    console.log('Admin project buyers request:', action, companyId, projectId, buyerId)

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseKey,
      {
        global: {
          headers: {
            Authorization: authHeader
          },
        },
      }
    )

    const serviceClient = createClient(
      supabaseUrl,
      supabaseServiceKey
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    
    if (authError) {
      console.error('Auth error:', authError)
      throw authError
    }
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    console.log('User authenticated:', user.id)

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Profile error:', profileError)
      throw profileError
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

    console.log('Admin user verified:', user.id)

    if (action === 'list') {
      // Direct database query without using execute_sql function
      let query = serviceClient
        .from('project_buyers')
        .select(`
          *,
          projects:project_id (
            name,
            companies:company_id (
              id,
              name
            )
          )
        `)
        .order('created_at', { ascending: false });

      // Apply filters if provided
      if (companyId) {
        query = query.eq('projects.companies.id', companyId);
      }
      
      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      
      if (filters) {
        if (filters.buyerStatus) {
          query = query.eq('buyer_status', filters.buyerStatus);
        }
        
        if (filters.contractStatus) {
          query = query.eq('contract_status', filters.contractStatus);
        }
        
        if (filters.creditAnalysisStatus) {
          query = query.eq('credit_analysis_status', filters.creditAnalysisStatus);
        }
        
        if (filters.fullName) {
          query = query.ilike('full_name', `%${filters.fullName}%`);
        }
        
        if (filters.cpf) {
          query = query.ilike('cpf', `%${filters.cpf}%`);
        }
      }

      const { data: buyers, error: buyersError } = await query;

      if (buyersError) {
        console.error('Project buyers query error:', buyersError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to fetch buyers',
            details: buyersError
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        );
      }

      // Transform the data to match the expected format
      const transformedBuyers = buyers.map(buyer => ({
        ...buyer,
        project_name: buyer.projects?.name || '',
        company_name: buyer.projects?.companies?.name || '',
        company_id: buyer.projects?.companies?.id || ''
      }));

      console.log('Buyers found:', transformedBuyers.length);
      
      return new Response(
        JSON.stringify({ buyers: transformedBuyers }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
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
      
      const { data: result, error: buyerError } = await serviceClient
        .rpc('execute_sql', {
          params: [buyerId],
          query_text: query
        });
      
      console.log('Single buyer RPC result:', { data: result, error: buyerError });
      
      if (buyerError) {
        console.error('Project buyer fetch error:', buyerError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to fetch buyer',
            details: buyerError
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        );
      }

      if (result?.error) {
        console.error('SQL execution error:', result);
        return new Response(
          JSON.stringify({ 
            error: 'SQL execution failed',
            details: result.error
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        );
      }

      const buyers = Array.isArray(result) ? result : [];
      
      if (!buyers.length) {
        return new Response(
          JSON.stringify({ error: 'Project buyer not found' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404 
          }
        )
      }
      
      const buyer = buyers[0];

      return new Response(
        JSON.stringify({ buyer }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    if (action === 'update' && buyerId && buyerData) {
      console.log('Admin updating project buyer with data:', buyerData)
      
      const { data: buyer, error: buyerError } = await serviceClient
        .from('project_buyers')
        .update(buyerData)
        .eq('id', buyerId)
        .select()
        .single()
      
      if (buyerError) {
        console.error('Project buyer update error:', buyerError)
        throw buyerError
      }

      return new Response(
        JSON.stringify({ buyer }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action or missing parameters' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )

  } catch (error) {
    console.error("Error in admin-project-buyers function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
