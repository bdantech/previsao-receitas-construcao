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
      return new Response(JSON.stringify({
        error: 'No authorization header'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 401
      });
    }
    // Initialize service role client for reliable database access
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    // Extract the token and verify the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        details: authError
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 401
      });
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
    if (action === 'uploadFile') {
      if (!requestData.file || !requestData.fileName || !requestData.resourceType || !requestData.resourceId) {
        return new Response(JSON.stringify({
          error: 'Missing required fields'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 400
        });
      }
      try {
        function sanitizeFilename(filename) {
          // Verifica se o filename é válido
          if (!filename || typeof filename !== 'string') {
            return 'default_filename.pdf'; // Nome padrão se a entrada for inválida
          }
          // Separa o nome da extensão
          const extensionMatch = filename.match(/(\.[a-zA-Z0-9]+)$/);
          let name = extensionMatch ? filename.slice(0, -extensionMatch[0].length) : filename;
          const extension = extensionMatch ? extensionMatch[0] : '.pdf'; // Assume .pdf se não houver extensão
          // Normaliza a string para remover acentos
          name = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          // Substitui caracteres não-ASCII e problemáticos por '_'
          name = name.replace(/[^a-zA-Z0-9._-]/g, '_');
          // Substitui múltiplos '_' consecutivos por um único '_'
          name = name.replace(/_+/g, '_');
          // Remove '_' no início ou fim do nome
          name = name.replace(/^_|_$/g, '');
          // Garante que o nome não esteja vazio
          if (!name) {
            name = 'file';
          }
          // Limita o comprimento do nome (ex.: 200 caracteres para deixar espaço para a extensão e caminho)
          const maxLength = 200;
          if (name.length > maxLength) {
            name = name.slice(0, maxLength);
          }
          // Retorna o nome completo com a extensão
          return `${name}${extension}`;
        }
        // Convert base64 to Uint8Array
        const base64Str = requestData.file.split('base64,')[1];
        const bytes = Uint8Array.from(atob(base64Str), (c)=>c.charCodeAt(0));
        // Create a unique file path
        const timestamp = new Date().getTime();
        const fileNameClean = sanitizeFilename(requestData.fileName);
        const uniqueFileName = `${timestamp}-${fileNameClean}`;
        const filePath = `${requestData.resourceType}/${requestData.resourceId}/${uniqueFileName}`;
        console.log('Uploading file to path:', filePath);
        // Make sure the bucket exists before uploading
        const { data: buckets, error: bucketsError } = await adminSupabase.storage.listBuckets();
        if (bucketsError) {
          console.error('Error listing buckets:', bucketsError);
          throw new Error(`Failed to check storage buckets: ${bucketsError.message}`);
        }
        const documentsBucketExists = buckets?.some((bucket)=>bucket.name === 'documents');
        if (!documentsBucketExists) {
          console.log('Creating documents bucket as it does not exist');
          const { error: createBucketError } = await adminSupabase.storage.createBucket('documents', {
            public: true
          });
          if (createBucketError) {
            console.error('Error creating documents bucket:', createBucketError);
            throw new Error(`Failed to create documents bucket: ${createBucketError.message}`);
          }
        }
        // Upload file to storage using admin client
        const { data: uploadData, error: uploadError } = await adminSupabase.storage.from('documents').upload(filePath, bytes, {
          contentType: 'application/pdf',
          upsert: true
        });
        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error(`Erro ao fazer upload do arquivo: ${uploadError.message}`);
        }
        console.log('File uploaded successfully:', uploadData);
        // Create a signed URL for immediate access
        const { data: urlData, error: urlError } = await adminSupabase.storage.from('documents').createSignedUrl(filePath, 60 * 60 * 24); // 24 hours expiry
        if (urlError) {
          console.error('Error creating signed URL:', urlError);
        // Continue anyway as it's not critical
        }
        // Verify the file exists in the bucket
        const { data: verifyData, error: verifyError } = await adminSupabase.storage.from('documents').list(filePath.split('/').slice(0, -1).join('/'));
        if (verifyError) {
          console.error('Error verifying file upload:', verifyError);
        } else {
          const fileExists = verifyData?.some((file)=>file.name === filePath.split('/').pop());
          if (!fileExists) {
            console.error('File was not found after upload:', filePath);
          } else {
            console.log('File successfully verified in storage:', filePath);
          }
        }
        // If document ID is provided, update the document record with new status
        if (requestData.documentId) {
          console.log('Updating document record with ID:', requestData.documentId);
          const now = new Date().toISOString();
          // Create update object with all required fields
          const documentUpdate = {
            file_path: filePath,
            file_name: fileNameClean,
            status: 'sent',
            submitted_at: now,
            updated_at: now,
            submitted_by: requestData.userId || user.id,
            file_size: bytes.length,
            mime_type: 'application/pdf' // Add mime type information
          };
          console.log('Updating document with data:', documentUpdate);
          const { data: updateData, error: updateError } = await adminSupabase.from('documents').update(documentUpdate).eq('id', requestData.documentId).select();
          if (updateError) {
            console.error('Error updating document record:', updateError);
            // Get more details about the specific error
            const { data: docInfo, error: docInfoError } = await adminSupabase.from('documents').select('*').eq('id', requestData.documentId).single();
            if (docInfoError) {
              console.error('Error checking document:', docInfoError);
            } else {
              console.log('Current document state:', docInfo);
            }
            // Don't throw here, still return success for the file upload
            console.log('File was uploaded but document record was not updated');
          } else {
            console.log('Document record updated successfully:', updateData);
          }
        }
        // If buyerId is provided, update the project_buyer record
        if (requestData.buyerId && requestData.resourceType === 'projects') {
          console.log('Updating project_buyer record with ID:', requestData.buyerId);
          console.log('Setting file path:', filePath);
          console.log('Setting file name:', fileNameClean);
          const { data: updateData, error: updateError } = await adminSupabase.from('project_buyers').update({
            contract_file_path: filePath,
            contract_file_name: fileNameClean,
            contract_status: 'a_analisar'
          }).eq('id', requestData.buyerId).select();
          if (updateError) {
            console.error('Error updating project_buyer:', updateError);
            // Don't throw here, still return success for the file upload
            console.log('File was uploaded but project_buyer record was not updated');
          } else {
            console.log('Project buyer record updated successfully:', updateData);
          }
        }
        // Set the file to be publicly accessible
        const { error: updatePublicError } = await adminSupabase.storage.from('documents').update(filePath, bytes, {
          contentType: 'application/pdf',
          upsert: true,
          cacheControl: '3600',
          allowedMimeTypes: [
            'application/pdf'
          ]
        });
        if (updatePublicError) {
          console.error('Error setting file to public:', updatePublicError);
        }
        return new Response(JSON.stringify({
          success: true,
          filePath: filePath,
          fileName: fileNameClean,
          signedUrl: urlData?.signedUrl
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      } catch (error) {
        console.error('Error uploading file:', error);
        return new Response(JSON.stringify({
          error: 'Failed to upload file',
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
  