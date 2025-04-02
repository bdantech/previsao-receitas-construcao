
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0';
import { cors } from '../_shared/cors.ts';
import { stripe } from '../_shared/stripe.ts';
import { get } from 'https://deno.land/x/lodash@4.17.15-es/lodash.js';
import { contentType } from "https://deno.land/std@0.177.0/media_types/mod.ts";
import { extname } from "https://deno.land/std@0.177.0/path/mod.ts";
import { sanitize } from "https://deno.land/x/sandstone/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Specify the allowed methods
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey || !supabaseServiceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY env variables')
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseKey,
      {
        auth: {
          persistSession: false
        }
      }
    )

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
    })

    const requestData = await req.json()
    const { action } = requestData

    if (action === 'getDocumentSignedUrl') {
      const { filePath } = requestData;

      if (!filePath) {
        return new Response(JSON.stringify({ error: 'Missing filePath parameter' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      const { data, error } = await serviceClient.storage
        .from('documents')
        .createSignedUrl(filePath, 60); // URL valid for 60 seconds

      if (error) {
        console.error('Error creating signed URL:', error);
        return new Response(JSON.stringify({ error: 'Failed to create signed URL' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      return new Response(JSON.stringify({ signedUrl: data.signedUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (requestData.action === 'getDocuments') {
      const { resourceType, resourceId } = requestData;

      if (!resourceType || !resourceId) {
        return new Response(
          JSON.stringify({ error: 'Missing resourceType or resourceId parameter' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const { data: documents, error } = await supabaseClient
        .from('documents')
        .select('*')
        .eq('resource_type', resourceType)
        .eq('resource_id', resourceId);

      if (error) {
        console.error('Error fetching documents:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch documents' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      return new Response(
        JSON.stringify({ documents }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Upload file action
    if (requestData.action === 'uploadFile') {
      const { file, fileName, resourceType, resourceId, documentId, userId, buyerId } = requestData;
      
      if (!file || !fileName || !resourceType || !resourceId) {
        return new Response(
          JSON.stringify({ 
            error: 'Missing required parameters for file upload' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Decode the base64 file
      const base64Data = file.split(',')[1];
      const fileContent = atob(base64Data);

      // Convert the file content to a Uint8Array
      const uint8Array = new Uint8Array(fileContent.length);
      for (let i = 0; i < fileContent.length; i++) {
        uint8Array[i] = fileContent.charCodeAt(i);
      }
      
      // Determine the file extension and MIME type
      const fileExtension = extname(fileName).slice(1);
      const mimeType = contentType(fileExtension) || 'application/octet-stream';
      
      // Sanitize the file name
      const sanitizedFileName = sanitize(fileName);
      
      // Calculate file size
      const fileSize = uint8Array.length;

      // Store file in Supabase Storage
      const timestamp = Date.now();
      const fileNameWithTimestamp = `${timestamp}-${sanitizedFileName}`;
      const storagePath = `${resourceType}/${resourceId}/${fileNameWithTimestamp}`;
      
      const { data: uploadData, error: uploadError } = await serviceClient.storage
        .from('documents')
        .upload(
          storagePath,
          uint8Array,
          {
            contentType: mimeType,
            upsert: true
          }
        );

      if (uploadError) {
        console.error('Error uploading to storage:', uploadError);
        throw uploadError;
      }

      // Update document record or buyer record based on the context
      if (documentId) {
        // Updating a document
        const { data: documentData, error: documentError } = await serviceClient
          .from('documents')
          .update({
            file_path: storagePath,
            file_name: fileName,
            mime_type: mimeType,
            file_size: fileSize,
            status: 'sent',
            submitted_by: userId,
            submitted_at: new Date().toISOString()
          })
          .eq('id', documentId)
          .select()
          .single();
        
        if (documentError) {
          console.error('Error updating document record:', documentError);
          throw documentError;
        }
      } else if (buyerId && resourceType === 'projects') {
        console.log('Updating buyer contract with buyerId:', buyerId);
        try {
          // Use the serviceClient (with admin privileges) to update contract status
          const { data: buyerData, error: buyerError } = await serviceClient
            .from('project_buyers')
            .update({
              contract_file_path: storagePath,
              contract_file_name: fileName,
              contract_status: 'a_analisar'  // Explicitly set to 'a_analisar' (Em Análise)
            })
            .eq('id', buyerId)
            .select()
            .single();
          
          if (buyerError) {
            console.error('Error updating buyer contract:', buyerError);
            throw buyerError;
          }
          
          console.log('Buyer contract updated successfully:', buyerData);
        } catch (updateError) {
          console.error('Error in update operation:', updateError);
          throw updateError;
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'File uploaded successfully', 
          path: storagePath,
          fileName: fileName,
          signedUrl: `${supabaseUrl}/storage/v1/object/sign/documents/${storagePath}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unsupported action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
