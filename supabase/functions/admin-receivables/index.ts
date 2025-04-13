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
    const { method, filters } = requestData;
    // Only GET method is supported for this admin function
    if (method !== 'GET') {
      return new Response(JSON.stringify({
        error: 'Method not allowed'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 405
      });
    }
    // Get all receivables (with optional filters)
    let query = serviceClient.from('receivables').select(`
        id,
        project_id,
        buyer_name,
        buyer_cpf,
        amount,
        due_date,
        description,
        status,
        created_at,
        updated_at,
        projects:project_id (
          name,
          company_id,
          companies:company_id (
            name
          )
        )
      `);
    // Apply filters if provided
    if (filters) {
      if (filters.projectId) {
        query = query.eq('project_id', filters.projectId);
      }
      if (filters.companyId) {
        query = query.eq('projects.company_id', filters.companyId);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.buyerCpf) {
        query = query.ilike('buyer_cpf', `%${filters.buyerCpf}%`);
      }
      if (filters.minAmount) {
        query = query.gte('amount', filters.minAmount);
      }
      if (filters.maxAmount) {
        query = query.lte('amount', filters.maxAmount);
      }
      if (filters.fromDate) {
        query = query.gte('due_date', filters.fromDate);
      }
      if (filters.toDate) {
        query = query.lte('due_date', filters.toDate);
      }
      if (filters.companyName) {
        // Busca empresas que correspondem ao filtro e têm nome não-nulo
        const { data: companies, error: companiesError } = await serviceClient.from('companies').select('id').ilike('name', `%${filters.companyName}%`).not('name', 'is', null); // Exclui empresas com nome nulo
        if (companiesError) {
          console.error('Companies lookup error:', companiesError);
          throw companiesError;
        }
        if (companies && companies.length > 0) {
          const companyIds = companies.map((c)=>c.id);
          query = query.in('projects.company_id', companyIds);
        } else {
          // Se não encontrar empresas, força resultado vazio
          query = query.eq('project_id', 'non-existent-id');
        }
      }
    }
    // Execute query and handle result
    const { data: receivables, error: receivablesError } = await query.order('due_date', {
      ascending: true
    });
    if (receivablesError) {
      console.error('Admin receivables error:', receivablesError);
      throw receivablesError;
    }
    // Process results to add company name at top level for easier access
    const processedReceivables = receivables.map((item)=>{
      const companyName = item.projects?.companies?.name;
      const projectName = item.projects?.name;
      // Se companyName estiver ativo, só inclui se companyName for válido
      if (filters?.companyName && (!companyName || companyName === 'Unknown Company')) {
        return null; // Exclui registros inválidos
      }
      return {
        ...item,
        company_name: companyName || 'Unknown Company',
        project_name: projectName || 'Unknown Project'
      };
    }).filter((item)=>item !== null); // Remove nulos do resultado
    // Calculate summary data
    const totalAmount = processedReceivables.reduce((sum, item)=>sum + Number(item.amount), 0);
    const count = processedReceivables.length;
    return new Response(JSON.stringify({
      receivables: processedReceivables,
      count: processedReceivables.length,
      summary: {
        totalAmount,
        count
      }
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error("Error in admin-receivables function:", error);
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
