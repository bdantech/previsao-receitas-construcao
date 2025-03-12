import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

// Configuração CORS para permitir chamadas do frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Tratamento para requisições OPTIONS (preflight CORS)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Obter URL da Supabase e chave anônima das variáveis de ambiente
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey || !supabaseServiceKey) {
      throw new Error('Missing environment variables')
    }

    // Obter o token de autorização do cabeçalho
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

    // Parse request body
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

    // Usar o token para autenticar o cliente do Supabase
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

    // Service client for operations that need admin privileges
    const serviceClient = createClient(
      supabaseUrl,
      supabaseServiceKey
    )

    // Autenticação e informações do usuário
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

    // Verify that the user is an admin
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

    // LIST all project buyers with optional filtering
    if (action === 'list') {
      // For improved performance, we'll construct a SQL query
      // that joins the necessary tables and applies filters
      let query = `
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
        WHERE 1=1
      `;
      
      const queryParams: any[] = [];
      let paramCounter = 1;
      
      // Apply filters if provided
      if (companyId) {
        query += ` AND c.id = $${paramCounter}`;
        queryParams.push(companyId);
        paramCounter++;
      }
      
      if (projectId) {
        query += ` AND p.id = $${paramCounter}`;
        queryParams.push(projectId);
        paramCounter++;
      }
      
      // Add filters for buyer_status, contract_status, or credit_analysis_status if provided
      if (filters) {
        if (filters.buyerStatus) {
          query += ` AND pb.buyer_status = $${paramCounter}`;
          queryParams.push(filters.buyerStatus);
          paramCounter++;
        }
        
        if (filters.contractStatus) {
          query += ` AND pb.contract_status = $${paramCounter}`;
          queryParams.push(filters.contractStatus);
          paramCounter++;
        }
        
        if (filters.creditAnalysisStatus) {
          query += ` AND pb.credit_analysis_status = $${paramCounter}`;
          queryParams.push(filters.creditAnalysisStatus);
          paramCounter++;
        }
        
        if (filters.fullName) {
          query += ` AND pb.full_name ILIKE $${paramCounter}`;
          queryParams.push(`%${filters.fullName}%`);
          paramCounter++;
        }
        
        if (filters.cpf) {
          query += ` AND pb.cpf LIKE $${paramCounter}`;
          queryParams.push(`%${filters.cpf}%`);
          paramCounter++;
        }
      }
      
      // Order by created_at desc by default
      query += ` ORDER BY pb.created_at DESC`;
      
      console.log('Executing query:', query, queryParams);
      
      const { data: buyers, error: buyersError } = await serviceClient
        .rpc('execute_sql', {
          params: {
            params: queryParams,
            query_text: query
          }
        });
      
      if (buyersError) {
        console.error('Project buyers query error:', buyersError);
        throw buyersError;
      }
      
      return new Response(
        JSON.stringify({ buyers: buyers || [] }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }
    
    // GET single project buyer (with company and project details)
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
      
      const { data: buyerResults, error: buyerError } = await serviceClient
        .rpc('execute_sql', {
          params: {
            params: [buyerId],
            query_text: query
          }
        });
      
      if (buyerError) {
        console.error('Project buyer fetch error:', buyerError)
        throw buyerError
      }
      
      if (!buyerResults || buyerResults.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Project buyer not found' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404 
          }
        )
      }
      
      const buyer = buyerResults[0];

      return new Response(
        JSON.stringify({ buyer }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }
    
    // UPDATE project buyer (admin can update any buyer)
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
