
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.32.0";

console.log("Admin company data service active");

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Create a Supabase client with the service role key
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    // Create a Supabase client for admin functionalities
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Extract the bearer token from the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.split(" ")[1];

    // Verify the token and get user data
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`User authenticated: ${user.id}`);

    // Get user's role from profiles
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profileData) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userRole = profileData.role;

    // This endpoint is for admin users only
    if (userRole !== "admin") {
      return new Response(
        JSON.stringify({ error: "Unauthorized. Admin access required." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body if it exists
    let requestBody = {};
    if (req.method === "POST") {
      try {
        requestBody = await req.json();
      } catch (error) {
        console.error("Error parsing request body:", error);
        requestBody = {};
      }
    }

    const { action, companyId } = requestBody as { action?: string; companyId?: string };

    // Handle admin actions
    if (action === "getCompanyDetails" && companyId) {
      console.log(`Fetching details for company: ${companyId}`);
      // Fetch specific company details
      const { data: company, error: companyError } = await supabaseAdmin
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .maybeSingle();  // Using maybeSingle instead of single to avoid errors

      if (companyError) {
        console.error("Error fetching company details:", companyError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch company details", details: companyError }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!company) {
        console.error("Company not found:", companyId);
        return new Response(
          JSON.stringify({ error: "Company not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Company details found:", company.name);
      return new Response(
        JSON.stringify({ company }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Default action: Fetch all companies
      const { data: companies, error: companiesError } = await supabaseAdmin
        .from("companies")
        .select("*")
        .order("name", { ascending: true });

      if (companiesError) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch companies", details: companiesError }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ companies }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
