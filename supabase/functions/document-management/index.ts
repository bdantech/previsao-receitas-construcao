
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      throw new Error('Missing environment variables');
    }

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      );
    }

    // Initialize the admin Supabase client
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract the token and verify the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      );
    }

    // Parse the request body
    const { action, file, fileName, resourceType, resourceId, buyerId } = await req.json();

    console.log('Received request:', { action, fileName, resourceType, resourceId, buyerId });

    if (action === 'uploadFile') {
      if (!file || !fileName || !resourceType || !resourceId) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        );
      }

      try {
        // Convert base64 to Uint8Array
        const base64Str = file.split('base64,')[1];
        const bytes = Uint8Array.from(atob(base64Str), c => c.charCodeAt(0));

        // Create a unique file path
        const timestamp = new Date().getTime();
        const uniqueFileName = `${timestamp}-${fileName}`;
        const filePath = `${resourceType}/${resourceId}/${uniqueFileName}`;

        // Upload file to storage using admin client
        const { data: uploadData, error: uploadError } = await adminSupabase
          .storage
          .from('documents')
          .upload(filePath, bytes, {
            contentType: 'application/pdf',
            upsert: true
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw uploadError;
        }

        console.log('File uploaded successfully:', uploadData);
        
        // If buyerId is provided, update the project_buyer record
        if (buyerId && resourceType === 'projects') {
          const { data: updateData, error: updateError } = await adminSupabase
            .from('project_buyers')
            .update({
              contract_file_path: filePath,
              contract_file_name: fileName,
              contract_status: 'a_analisar'
            })
            .eq('id', buyerId)
            .select();
            
          if (updateError) {
            console.error('Error updating project_buyer:', updateError);
            // Don't throw here, still return success for the file upload
            console.log('File was uploaded but project_buyer record was not updated');
          } else {
            console.log('Project buyer record updated successfully:', updateData);
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            filePath: filePath,
            fileName: fileName
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      } catch (error) {
        console.error('Error uploading file:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to upload file', details: error.message }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  } catch (error) {
    console.error('Error in document-management function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
