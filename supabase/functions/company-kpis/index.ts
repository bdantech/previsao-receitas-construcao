import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Hello from company-kpis!");

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Get request body
    const { companyId } = await req.json();

    if (!companyId) {
      throw new Error('Company ID is required');
    }

    // Verify user has access to this company
    const { data: userCompany, error: userCompanyError } = await supabaseAdmin
      .from('user_companies')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .single();

    if (userCompanyError || !userCompany) {
      throw new Error('User does not have access to this company');
    }

    // Get all projects for the company
    const { data: projects, error: projectsError } = await supabaseAdmin
      .from('projects')
      .select('id, buyers:project_buyers(id)')
      .eq('company_id', companyId);

    if (projectsError) {
      throw projectsError;
    }

    // Calculate total projects and unique buyers
    const totalProjects = projects?.length || 0;
    const totalBuyers = new Set(projects?.flatMap(p => p.buyers.map(b => b.id))).size;

    // Get receivables by status
    const { data: receivables, error: receivablesError } = await supabaseAdmin
      .from('receivables')
      .select('status, amount')
      .in('project_id', projects?.map(p => p.id) || []);

    if (receivablesError) {
      throw receivablesError;
    }

    const receivablesByStatus = receivables?.reduce((acc, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);

    // Get anticipations by status
    const { data: anticipations, error: anticipationsError } = await supabaseAdmin
      .from('anticipations')
      .select('status, amount')
      .in('project_id', projects?.map(p => p.id) || []);

    if (anticipationsError) {
      throw anticipationsError;
    }

    const anticipationsByStatus = anticipations?.reduce((acc, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);

    // Get boletos by status
    const { data: boletos, error: boletosError } = await supabaseAdmin
      .from('boletos')
      .select('status, amount')
      .in('project_id', projects?.map(p => p.id) || []);

    if (boletosError) {
      throw boletosError;
    }

    const boletosByStatus = boletos?.reduce((acc, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);

    return new Response(
      JSON.stringify({
        totalProjects,
        totalBuyers,
        receivablesByStatus,
        anticipationsByStatus,
        boletosByStatus,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error.message);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 400,
      }
    );
  }
}); 