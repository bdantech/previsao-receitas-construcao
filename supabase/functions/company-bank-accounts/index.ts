import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables");
    }
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: "No authorization header"
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 401
      });
    }
    // Initialize service role client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Extract the token and verify the user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({
        error: "Unauthorized",
        details: authError
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 401
      });
    }
    // Get user's companies
    const { data: userCompanies, error: userCompaniesError } = await supabase.from("user_companies").select("company_id").eq("user_id", user.id);
    if (userCompaniesError) {
      return new Response(JSON.stringify({
        error: "Failed to fetch user companies",
        details: userCompaniesError
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 500
      });
    }
    const companyIds = userCompanies.map((uc)=>uc.company_id);
    if (companyIds.length === 0) {
      return new Response(JSON.stringify({
        data: []
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 200
      });
    }
    const { data: bankAccounts, error: bankAccountsError } = await supabase.from("bank_accounts").select(`
        *,
        companies:company_id (
          id,
          name,
          cnpj
        ),
        projects:project_id (
          id,
          name
        )
      `).in("company_id", companyIds);
    if (bankAccountsError) {
      return new Response(JSON.stringify({
        error: "Failed to fetch bank accounts",
        details: bankAccountsError
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 500
      });
    }
    return new Response(JSON.stringify({
      data: bankAccounts
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 200
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Internal server error",
      details: error.message
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 500
    });
  }
});
