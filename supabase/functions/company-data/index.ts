
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.32.0";

console.log("Company data service active");

// Create a Supabase client with the service role key
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req: Request) => {
  try {
    // Create a Supabase client for admin functionalities
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Extract the bearer token from the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.split(" ")[1];

    // Verify the token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching company data for user: ${user.id}`);

    // Get user's role from profiles
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profileData) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const userRole = profileData.role;

    // Check if the user is an admin
    if (userRole !== "admin") {
      return new Response(
        JSON.stringify({ error: "Unauthorized. Admin access required." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    let requestBody = {};
    if (req.method === "POST") {
      requestBody = await req.json();
    }

    const { action, companyId } = requestBody as { action?: string; companyId?: string };

    // Handle different actions
    if (action === "getCompanyDetails" && companyId) {
      // Fetch specific company details
      const { data: company, error: companyError } = await supabaseAdmin
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .single();

      if (companyError) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch company details", details: companyError }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ company }),
        { headers: { "Content-Type": "application/json" } }
      );
    } else {
      // Default action: Fetch all companies for admin user
      const { data: companies, error: companiesError } = await supabaseAdmin
        .from("companies")
        .select("*")
        .order("name", { ascending: true });

      if (companiesError) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch companies", details: companiesError }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ companies }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
