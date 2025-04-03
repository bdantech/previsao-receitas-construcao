import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey || !supabaseServiceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY env variables');
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
   

    // Initialize service role client for reliable database access
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

    const requestData = await req.json();
    const { action } = requestData;
    if (action === 'getDocumentSignedUrl') {
      const { filePath } = requestData;
      if (!filePath) {
        return new Response(JSON.stringify({
          error: 'Missing filePath parameter'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 400
        });
      }
      const { data, error } = await adminSupabase.storage.from('documents').createSignedUrl(filePath, 60); // URL valid for 60 seconds
      if (error) {
        console.error('Error creating signed URL:', error);
        return new Response(JSON.stringify({
          error: 'Failed to create signed URL'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 500
        });
      }
      return new Response(JSON.stringify({
        signedUrl: data.signedUrl
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
    if (requestData.action === 'getDocuments') {
      const { resourceType, resourceId } = requestData;
      console.log('Fetching documents for resourceType:', resourceType, 'and resourceId:', resourceId);
      if (!resourceType || !resourceId) {
        return new Response(JSON.stringify({
          error: 'Missing resourceType or resourceId parameter'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 400
        });
      }
      const { data: documents, error } = await adminSupabase.from('documents').select('*, document_type:document_types!document_type_id(*)') // Usa alias para renomear
      .eq('resource_type', resourceType).eq('resource_id', resourceId);
      console.log('Documents fetched:', documents);
      if (error) {
        console.error('Error fetching documents:', error);
        return new Response(JSON.stringify({
          error: 'Failed to fetch documents'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 500
        });
      }
      return new Response(JSON.stringify({
        documents
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
    // Upload file action
    if (requestData.action === 'uploadFile') {
      const { file, fileName, resourceType, resourceId, documentId, userId, buyerId } = requestData;
      if (!file || !fileName || !resourceType || !resourceId) {
        return new Response(JSON.stringify({
          error: 'Missing required parameters for file upload'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 400
        });
      }
      // Decode the base64 file
      const base64Data = file.split(',')[1];
      const fileContent = atob(base64Data);
      // Convert the file content to a Uint8Array
      const uint8Array = new Uint8Array(fileContent.length);
      for(let i = 0; i < fileContent.length; i++){
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
      const { data: uploadData, error: uploadError } = await adminSupabase.storage.from('documents').upload(storagePath, uint8Array, {
        contentType: mimeType,
        upsert: true
      });
      if (uploadError) {
        console.error('Error uploading to storage:', uploadError);
        throw uploadError;
      }
      // Update document record or buyer record based on the context
      if (documentId) {
        // Updating a document
        const { data: documentData, error: documentError } = await adminSupabase.from('documents').update({
          file_path: storagePath,
          file_name: fileName,
          mime_type: mimeType,
          file_size: fileSize,
          status: 'sent',
          submitted_by: userId,
          submitted_at: new Date().toISOString()
        }).eq('id', documentId).select().single();
        if (documentError) {
          console.error('Error updating document record:', documentError);
          throw documentError;
        }
      } else if (buyerId && resourceType === 'projects') {
        console.log('Updating buyer contract with buyerId:', buyerId);
        try {
          // Use the adminSupabase (with admin privileges) to update contract status
          const { data: buyerData, error: buyerError } = await adminSupabase.from('project_buyers').update({
            contract_file_path: storagePath,
            contract_file_name: fileName,
            contract_status: 'a_analisar' // Explicitly set to 'a_analisar' (Em Análise)
          }).eq('id', buyerId).select().single();
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
      return new Response(JSON.stringify({
        success: true,
        message: 'File uploaded successfully',
        path: storagePath,
        fileName: fileName,
        signedUrl: `${supabaseUrl}/storage/v1/object/sign/documents/${storagePath}`
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }

    if (action === 'updateDocumentStatus') {
      const { documentId, status, reviewNotes } = requestData;
      if (!documentId || !status) {
        return new Response(JSON.stringify({
          error: 'Missing required fields: documentId and status'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 400
        });
      }
      // Validate status
      const validStatuses = [
        'approved',
        'needs_revision',
        'rejected'
      ];
      if (!validStatuses.includes(status)) {
        return new Response(JSON.stringify({
          error: 'Invalid status. Must be one of: approved, needs_revision, rejected'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 400
        });
      }
      try {
        // Check if user is admin
        const { data: userProfile, error: profileError } = await adminSupabase.from('profiles').select('role').eq('id', user.id).single();
        if (profileError) {
          console.error('Error fetching user profile:', profileError);
          throw profileError;
        }
        if (userProfile.role !== 'admin') {
          return new Response(JSON.stringify({
            error: 'Only admin users can update document status'
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            },
            status: 403
          });
        }
        // Update the document status
        const now = new Date().toISOString();
        const updateData = {
          status: status,
          reviewed_by: user.id,
          reviewed_at: now,
          review_notes: null
        };
        if (reviewNotes !== undefined) {
          updateData.review_notes = reviewNotes;
        }
        console.log(`Updating document ${documentId} status to ${status}`);
        // First get the document to know the company ID
        const { data: documentData, error: documentError } = await adminSupabase.from('documents').select('resource_id, resource_type').eq('id', documentId).single();
        if (documentError) {
          console.error('Error fetching document:', documentError);
          throw documentError;
        }
        // Update the document
        const { data: document, error: updateError } = await adminSupabase.from('documents').update(updateData).eq('id', documentId).select('*, document_type:document_type_id(*)').single();
        if (updateError) {
          console.error('Error updating document status:', updateError);
          throw updateError;
        }
        console.log('Document status updated successfully:', document);
        // If document is for a company and status changed to approved,
        // check if all required documents are approved
        if (documentData.resource_type === 'company' && status === 'approved') {
          const companyId = documentData.resource_id;
          try {
            // Check if all required documents are approved for this company
            const { data: requiredDocuments, error: requiredDocsError } = await adminSupabase.from('documents').select(`
                id, 
                status, 
                document_type:document_type_id(id, name, required)
              `).eq('resource_type', 'company').eq('resource_id', companyId);
            if (requiredDocsError) {
              console.error('Error fetching required documents:', requiredDocsError);
              throw requiredDocsError;
            }
            // Check if any required documents are not approved
            const pendingRequiredDocs = requiredDocuments.filter((doc)=>doc.document_type.required && doc.status !== 'approved');
            // If all required documents are approved, update company status to approved
            if (pendingRequiredDocs.length === 0) {
              console.log('All required documents are approved, updating company status');
              try {
                // Call the stored procedure to update company status
                const { data: companyData, error: companyError } = await adminSupabase.rpc('update_company_documents_status', {
                  p_company_id: companyId,
                  p_status: 'approved'
                });
                if (companyError) {
                  console.error('Error updating company status:', companyError);
                  throw new Error(`Company status update error: ${JSON.stringify(companyError)}`);
                }
                console.log('Company status updated to approved:', companyData);
              } catch (companyUpdateError) {
                console.error('Exception during company status update:', companyUpdateError);
                // Don't throw here - we still want to return success for the document update
                console.log('Company status update failed but document was updated successfully');
              }
            } else {
              console.log('Not all required documents are approved yet, remaining:', pendingRequiredDocs.map((d)=>d.document_type.name).join(', '));
            }
          } catch (companyCheckError) {
            console.error('Error checking company documents status:', companyCheckError);
          // Continue and return success for document update even if company status check fails
          }
        }
        return new Response(JSON.stringify({
          success: true,
          message: 'Document status updated successfully',
          document
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      } catch (error) {
        console.error('Error handling updateDocumentStatus request:', error);
        return new Response(JSON.stringify({
          error: 'Failed to update document status',
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

    return new Response(JSON.stringify({
      error: 'Unsupported action'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 400
    });
  } catch (error) {
    console.error('Error:', error);
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
