import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
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
    // Initialize Supabase client with user's auth token
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    // Service client for operations that bypass RLS
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
    // Get request body
    const requestData = await req.json();
    const companyId = requestData.companyId;
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
    // Verify user has access to this company
    const { data: userCompany, error: userCompanyError } = await serviceClient.from('user_companies').select('company_id').eq('user_id', user.id).eq('company_id', companyId).single();
    if (userCompanyError || !userCompany) {
      console.error('Company access error:', userCompanyError);
      return new Response(JSON.stringify({
        error: 'User does not have access to this company'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 403
      });
    }
    // Get all projects for the company
    const { data: projects, error: projectsError } = await serviceClient.from('projects').select(`
        id,
        status,
        project_buyers (
          id
        )
      `).eq('company_id', companyId);
    if (projectsError) {
      console.error('Projects error:', projectsError);
      throw projectsError;
    }
    // Calculate active projects and total unique buyers
    const activeProjects = projects?.filter((project)=>project.status === 'active').length || 0;
    const totalBuyers = new Set(projects?.flatMap((project)=>project.project_buyers.map((buyer)=>buyer.id))).size;
    // Get receivables by status
    const { data: receivables, error: receivablesError } = await serviceClient.from('receivables').select('status, amount').in('project_id', projects?.map((p)=>p.id) || []);
    if (receivablesError) {
      console.error('Receivables error:', receivablesError);
      throw receivablesError;
    }
    // Calculate receivables by status
    const receivablesByStatus = receivables?.reduce((acc, curr)=>{
      acc[curr.status] = (acc[curr.status] || 0) + (curr.amount || 0);
      return acc;
    }, {}) || {};
    // Get anticipations by status
    const { data: anticipations, error: anticipationsError } = await serviceClient.from('anticipations').select('status, amount').in('project_id', projects?.map((p)=>p.id) || []);
    if (anticipationsError) {
      console.error('Anticipations error:', anticipationsError);
      throw anticipationsError;
    }
    // Calculate anticipations by status
    const anticipationsByStatus = anticipations?.reduce((acc, curr)=>{
      acc[curr.status] = (acc[curr.status] || 0) + (curr.amount || 0);
      return acc;
    }, {}) || {};
    // Get boletos by status
    const { data: boletos, error: boletosError } = await serviceClient.from('boletos').select('status, amount').in('project_id', projects?.map((p)=>p.id) || []);
    if (boletosError) {
      console.error('Boletos error:', boletosError);
      throw boletosError;
    }
    // Calculate boletos by status
    const boletosByStatus = boletos?.reduce((acc, curr)=>{
      acc[curr.status] = (acc[curr.status] || 0) + (curr.amount || 0);
      return acc;
    }, {}) || {};
    return new Response(JSON.stringify({
      activeProjects,
      totalBuyers,
      receivablesByStatus,
      anticipationsByStatus,
      boletosByStatus
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
