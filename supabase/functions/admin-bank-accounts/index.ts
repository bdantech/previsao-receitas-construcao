import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
};

serve(async (req) => {
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
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401 
        }
      );
    }

    let requestData;
    try {
      const text = await req.text();
      console.log("Request body:", text);
      requestData = text ? JSON.parse(text) : {};
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid request body", details: parseError.message }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400 
        }
      );
    }

    // Initialize service role client for admin operations
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract the token and verify the user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: authError }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401 
        }
      );
    }

    // Verify user is an admin
    const { data: profile, error: profileError } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Admin access required" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403 
        }
      );
    }

    const { action = "list", ...data } = requestData;

    switch (action) {
      case "list": {
        console.log("Fetching bank accounts...");
        const { data: bankAccounts, error: listError } = await adminSupabase
          .from("bank_accounts")
          .select(`
            *,
            companies:company_id (
              id,
              name
            ),
            projects:project_id (
              id,
              name
            )
          `);

        console.log("Bank accounts query result:", { bankAccounts, listError });

        if (listError) {
          console.error("Error fetching bank accounts:", listError);
          return new Response(
            JSON.stringify({ error: "Failed to fetch bank accounts", details: listError }),
            { 
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 500 
            }
          );
        }

        console.log("Returning bank accounts:", bankAccounts);
        return new Response(
          JSON.stringify(bankAccounts),
          { 
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200 
          }
        );
      }

      case "create": {
        const { account_name, account_number, balance, private_key, public_key, bank_project_id, company_id, project_id, bank_account_url } = data;
        
        // Verify company exists
        const { data: company, error: companyError } = await adminSupabase
          .from("companies")
          .select("id")
          .eq("id", company_id)
          .single();

        if (companyError || !company) {
          return new Response(
            JSON.stringify({ error: "Company not found" }),
            { 
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 404 
            }
          );
        }

        // Verify project exists and belongs to the company
        const { data: project, error: projectError } = await adminSupabase
          .from("projects")
          .select("id")
          .eq("id", project_id)
          .eq("company_id", company_id)
          .single();

        if (projectError || !project) {
          return new Response(
            JSON.stringify({ error: "Project not found or does not belong to the specified company" }),
            { 
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 404 
            }
          );
        }

        const { data: bankAccount, error: createError } = await adminSupabase
          .from("bank_accounts")
          .insert({
            account_name,
            account_number,
            balance,
            private_key,
            public_key,
            bank_project_id,
            company_id,
            project_id,
            bank_account_url
          })
          .select()
          .single();

        if (createError) {
          return new Response(
            JSON.stringify({ error: "Failed to create bank account", details: createError }),
            { 
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 500 
            }
          );
        }

        return new Response(
          JSON.stringify({ data: bankAccount }),
          { 
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 201 
          }
        );
      }

      case "update": {
        const { id, ...updateData } = data;
        
        const { data: bankAccount, error: updateError } = await adminSupabase
          .from("bank_accounts")
          .update(updateData)
          .eq("id", id)
          .select()
          .single();

        if (updateError) {
          return new Response(
            JSON.stringify({ error: "Failed to update bank account", details: updateError }),
            { 
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 500 
            }
          );
        }

        return new Response(
          JSON.stringify({ data: bankAccount }),
          { 
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200 
          }
        );
      }

      case "delete": {
        const { id } = data;
        
        const { error: deleteError } = await adminSupabase
          .from("bank_accounts")
          .delete()
          .eq("id", id);

        if (deleteError) {
          return new Response(
            JSON.stringify({ error: "Failed to delete bank account", details: deleteError }),
            { 
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 500 
            }
          );
        }

        return new Response(
          JSON.stringify({ message: "Bank account deleted successfully" }),
          { 
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200 
          }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { 
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400 
          }
        );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
}); 