import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      throw new Error("Missing environment variables");
    }
    // Get the authorization header
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
    // Initialize the admin Supabase client
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    // Extract the token and verify the user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);
    if (authError || !user) {
      console.error("Auth error:", authError);
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
    // Parse the URL path to see if this is a direct file request
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const lastPart = pathParts[pathParts.length - 1];
    // Get the request body
    const requestBody = await req.json().catch(()=>({}));
    const { action } = requestBody;
    console.log("Document management function called with action:", action);
    switch(action){
      case "downloadFile":
        {
          const { bucketName, filePath } = requestBody.data;
          try {
            // Create a signed URL with an expiration of 60 minutes (3600 seconds)
            const { data, error } = await adminSupabase.storage.from(bucketName).createSignedUrl(filePath, 3600, {
              download: true
            });
            if (error) {
              console.error('Error creating signed URL:', error);
              // If file not found, return a clear error
              if (error.message.includes('not found') || error.message.includes('does not exist')) {
                return new Response(JSON.stringify({
                  error: 'File not found',
                  details: 'The requested file does not exist'
                }), {
                  headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                  },
                  status: 404
                });
              }
              throw error;
            }
            if (!data || !data.signedUrl) {
              throw new Error('Failed to generate signed URL');
            }
            console.log('Successfully created signed URL for download:', data.signedUrl);
            return new Response(JSON.stringify({
              success: true,
              url: data.signedUrl
            }), {
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              },
              status: 200
            });
          } catch (error) {
            console.error('Error handling download file request:', error);
            return new Response(JSON.stringify({
              error: 'Failed to generate download URL',
              details: error.message
            }), {
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              },
              status: 500
            });
          }
        }
    }
    return new Response(JSON.stringify({
      error: "Invalid action"
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 400
    });
  } catch (error) {
    console.error("Error in document-management function:", error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 500
    });
  }
});
