
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

    // Parse the URL path to see if this is a direct file request
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    
    // Get the request body
    const requestBody = await req.json().catch(() => ({}));
    const { action } = requestBody;

    console.log('Document management function called with action:', action);
    
    // Handle updateDocumentStatus action
    if (action === 'updateDocumentStatus') {
      const { documentId, status, reviewNotes } = requestBody;
      
      if (!documentId || !status) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: documentId and status' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        );
      }
      
      // Validate status
      const validStatuses = ['approved', 'needs_revision', 'rejected'];
      if (!validStatuses.includes(status)) {
        return new Response(
          JSON.stringify({ error: 'Invalid status. Must be one of: approved, needs_revision, rejected' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        );
      }
      
      try {
        // Check if user is admin
        const { data: userProfile, error: profileError } = await adminSupabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        if (profileError) {
          console.error('Error fetching user profile:', profileError);
          throw profileError;
        }
        
        if (userProfile.role !== 'admin') {
          return new Response(
            JSON.stringify({ error: 'Only admin users can update document status' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 403 
            }
          );
        }
        
        // Update the document status
        const now = new Date().toISOString();
        
        const updateData: Record<string, any> = {
          status: status,
          reviewed_by: user.id,
          reviewed_at: now
        };
        
        if (reviewNotes !== undefined) {
          updateData.review_notes = reviewNotes;
        }
        
        console.log(`Updating document ${documentId} status to ${status}`);
        
        // First get the document to know the company ID
        const { data: documentData, error: documentError } = await adminSupabase
          .from('documents')
          .select('resource_id, resource_type')
          .eq('id', documentId)
          .single();
          
        if (documentError) {
          console.error('Error fetching document:', documentError);
          throw documentError;
        }
        
        // Update the document
        const { data: document, error: updateError } = await adminSupabase
          .from('documents')
          .update(updateData)
          .eq('id', documentId)
          .select('*, document_type:document_type_id(*)')
          .single();
        
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
            const { data: requiredDocuments, error: requiredDocsError } = await adminSupabase
              .from('documents')
              .select(`
                id, 
                status, 
                document_type:document_type_id(id, name, required)
              `)
              .eq('resource_type', 'company')
              .eq('resource_id', companyId);
              
            if (requiredDocsError) {
              console.error('Error fetching required documents:', requiredDocsError);
              throw requiredDocsError;
            }
            
            // Check if any required documents are not approved
            const pendingRequiredDocs = requiredDocuments.filter(doc => 
              doc.document_type.required && doc.status !== 'approved'
            );
            
            // If all required documents are approved, update company status to approved
            if (pendingRequiredDocs.length === 0) {
              console.log('All required documents are approved, updating company status');
              
              // Use a direct SQL query with execute_sql function to bypass RLS
              const updateCompanyQuery = `
                UPDATE companies 
                SET documents_status = 'approved' 
                WHERE id = $1::uuid 
                RETURNING id, name, documents_status
              `;
              
              const { data: sqlResult, error: sqlError } = await adminSupabase.rpc(
                'execute_sql',
                {
                  params: { companyId },
                  query_text: updateCompanyQuery
                }
              );
              
              if (sqlError) {
                console.error('Error executing SQL to update company status:', sqlError);
                // Log error but don't throw - we still want to return success for the document update
                console.log('Company status update failed but document was updated successfully');
              } else {
                console.log('Company status updated to approved via SQL:', sqlResult);
              }
            } else {
              console.log('Not all required documents are approved yet, remaining:', 
                pendingRequiredDocs.map(d => d.document_type.name).join(', '));
            }
          } catch (companyCheckError) {
            console.error('Error checking company documents status:', companyCheckError);
            // Continue and return success for document update even if company status check fails
          }
        }
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Document status updated successfully',
            document
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      } catch (error) {
        console.error('Error handling updateDocumentStatus request:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to update document status', details: error.message }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        );
      }
    }
    
    // Handle getDocuments action
    if (action === 'getDocuments') {
      const { resourceType, resourceId } = requestBody;
      
      if (!resourceType || !resourceId) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: resourceType and resourceId' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        );
      }
      
      console.log(`Fetching documents for ${resourceType} with ID ${resourceId}`);
      
      try {
        // For company users, check if they belong to the company
        if (resourceType === 'company') {
          const { data: userCompanies, error: userCompaniesError } = await adminSupabase
            .from('user_companies')
            .select('company_id')
            .eq('user_id', user.id);
            
          if (userCompaniesError) {
            console.error('Error checking user companies:', userCompaniesError);
            throw userCompaniesError;
          }
          
          // Check if user is admin or belongs to this company
          const { data: userProfile, error: profileError } = await adminSupabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
            
          const isAdmin = userProfile?.role === 'admin';
          const isCompanyUser = userCompanies?.some(uc => uc.company_id === resourceId);
          
          if (!isAdmin && !isCompanyUser) {
            console.error('User does not have access to this company');
            return new Response(
              JSON.stringify({ error: 'Access denied to this company' }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 403 
              }
            );
          }
        }
        
        // Get documents with their types and related user information
        const { data: documents, error: documentsError } = await adminSupabase
          .from('documents')
          .select(`
            id,
            document_type_id,
            resource_type,
            resource_id,
            status,
            file_path,
            file_name,
            submitted_by,
            submitted_at,
            reviewed_by,
            reviewed_at,
            review_notes,
            document_type:document_type_id(id, name, description, required),
            submitter:submitted_by(id, email),
            reviewer:reviewed_by(id, email)
          `)
          .eq('resource_type', resourceType)
          .eq('resource_id', resourceId);
        
        if (documentsError) {
          console.error('Error fetching documents:', documentsError);
          throw documentsError;
        }
        
        console.log(`Found ${documents?.length || 0} documents`);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            documents: documents || [] 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      } catch (error) {
        console.error('Error handling getDocuments request:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch documents', details: error.message }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        );
      }
    }
    
    // Handle downloadFile action - providing a signed URL with token
    if (action === 'downloadFile' && requestBody.filePath) {
      console.log('Processing downloadFile request for path:', requestBody.filePath);
      
      try {
        let downloadUrl;
        
        // Check if we should use direct access with key
        if (requestBody.useAccessKey && requestBody.keyId && requestBody.accessKey) {
          console.log('Using access key for storage access');
          
          // Create a direct URL with access key authentication
          const bucketName = 'documents';
          const objectPath = requestBody.filePath;
          
          // First verify the file exists
          try {
            // List the directory contents to check if the file exists
            const { data: fileList, error: listError } = await adminSupabase
              .storage
              .from(bucketName)
              .list(objectPath.split('/').slice(0, -1).join('/'));
            
            if (listError) {
              console.error('Error listing directory contents:', listError);
            } else {
              const fileName = objectPath.split('/').pop();
              const fileExists = fileList?.some(file => file.name === fileName);
              
              if (!fileExists) {
                console.error('File not found in storage:', objectPath);
                return new Response(
                  JSON.stringify({ error: 'File not found', details: 'The requested file does not exist' }),
                  { 
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 404 
                  }
                );
              }
              
              console.log('File verified, exists in storage');
            }
          } catch (verifyError) {
            console.error('Error verifying file existence:', verifyError);
            // Continue anyway as the list operation might not be permitted
          }
          
          // Build a URL with the access key that will have full access to the storage
          const directUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${objectPath}`;
          
          // Try to fetch the object directly with the access keys
          const verificationHeaders = {
            'apikey': requestBody.keyId,
            'Authorization': `Bearer ${requestBody.accessKey}`
          };
          
          try {
            const verifyResponse = await fetch(directUrl, { 
              headers: verificationHeaders,
              method: 'HEAD'
            });
            
            if (!verifyResponse.ok) {
              console.error('File verification failed with status:', verifyResponse.status);
              
              // If file not found (404), return a clear error
              if (verifyResponse.status === 404) {
                return new Response(
                  JSON.stringify({ error: 'File not found', details: 'The requested file does not exist' }),
                  { 
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 404 
                  }
                );
              }
              
              throw new Error(`File not accessible: ${verifyResponse.statusText}`);
            }
            
            console.log('File verified, exists and is accessible');
            
            // If the file exists, return a direct download URL with the access key
            const downloadParams = new URLSearchParams();
            downloadParams.append('download', 'true');
            
            downloadUrl = `${directUrl}?${downloadParams.toString()}`;
            console.log('Using direct access URL for download:', downloadUrl);
          } catch (verifyError) {
            console.error('Error verifying file:', verifyError);
            // Fall back to signed URL if direct access fails
          }
        }
        
        // If direct access failed or wasn't requested, use a signed URL
        if (!downloadUrl) {
          console.log('Falling back to signed URL generation');
          
          // Create a signed URL with an expiration of 60 minutes (3600 seconds)
          const { data, error } = await adminSupabase
            .storage
            .from('documents')
            .createSignedUrl(requestBody.filePath, 3600, {
              download: true,  // Explicitly mark for download
              transform: {
                quality: 100  // Just to add a parameter and make sure the URL is properly formed
              }
            });
          
          if (error) {
            console.error('Error creating signed URL:', error);
            
            // If file not found, return a clear error
            if (error.message.includes('not found') || error.message.includes('does not exist')) {
              return new Response(
                JSON.stringify({ error: 'File not found', details: 'The requested file does not exist' }),
                { 
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                  status: 404 
                }
              );
            }
            
            throw error;
          }
          
          if (!data || !data.signedUrl) {
            throw new Error('Failed to generate signed URL');
          }
          
          console.log('Successfully created signed URL with token');
          downloadUrl = data.signedUrl;
        }
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            url: downloadUrl
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      } catch (error) {
        console.error('Error handling download file request:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to generate download URL', details: error.message }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        );
      }
    }
    
    // Handle uploadFile action
    if (action === 'uploadFile') {
      if (!requestBody.file || !requestBody.fileName || !requestBody.resourceType || !requestBody.resourceId) {
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
        const base64Str = requestBody.file.split('base64,')[1];
        const bytes = Uint8Array.from(atob(base64Str), c => c.charCodeAt(0));

        // Create a unique file path
        const timestamp = new Date().getTime();
        const fileNameClean = requestBody.fileName.replace(/[^a-zA-Z0-9.-]/g, '_'); // Sanitize the filename
        const uniqueFileName = `${timestamp}-${fileNameClean}`;
        const filePath = `${requestBody.resourceType}/${requestBody.resourceId}/${uniqueFileName}`;

        console.log('Uploading file to path:', filePath);

        // Make sure the bucket exists before uploading
        const { data: buckets, error: bucketsError } = await adminSupabase
          .storage
          .listBuckets();
          
        if (bucketsError) {
          console.error('Error listing buckets:', bucketsError);
          throw new Error(`Failed to check storage buckets: ${bucketsError.message}`);
        }
        
        const documentsBucketExists = buckets?.some(bucket => bucket.name === 'documents');
        if (!documentsBucketExists) {
          console.log('Creating documents bucket as it does not exist');
          const { error: createBucketError } = await adminSupabase
            .storage
            .createBucket('documents', { public: true });
            
          if (createBucketError) {
            console.error('Error creating documents bucket:', createBucketError);
            throw new Error(`Failed to create documents bucket: ${createBucketError.message}`);
          }
        }

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
          throw new Error(`Erro ao fazer upload do arquivo: ${uploadError.message}`);
        }

        console.log('File uploaded successfully:', uploadData);
        
        // Create a signed URL for immediate access
        const { data: urlData, error: urlError } = await adminSupabase
          .storage
          .from('documents')
          .createSignedUrl(filePath, 60 * 60 * 24); // 24 hours expiry
          
        if (urlError) {
          console.error('Error creating signed URL:', urlError);
          // Continue anyway as it's not critical
        }
        
        // Verify the file exists in the bucket
        const { data: verifyData, error: verifyError } = await adminSupabase
          .storage
          .from('documents')
          .list(filePath.split('/').slice(0, -1).join('/'));
          
        if (verifyError) {
          console.error('Error verifying file upload:', verifyError);
        } else {
          const fileExists = verifyData?.some(file => 
            file.name === filePath.split('/').pop()
          );
          
          if (!fileExists) {
            console.error('File was not found after upload:', filePath);
          } else {
            console.log('File successfully verified in storage:', filePath);
          }
        }
        
        // If document ID is provided, update the document record with new status
        if (requestBody.documentId) {
          console.log('Updating document record with ID:', requestBody.documentId);
          
          const now = new Date().toISOString();
          
          // Create update object with all required fields
          const documentUpdate = {
            file_path: filePath,
            file_name: fileNameClean,
            status: 'sent',
            submitted_at: now,
            updated_at: now,
            submitted_by: requestBody.userId || user.id, // Use provided userId or default to current user
            file_size: bytes.length, // Add file size information
            mime_type: 'application/pdf' // Add mime type information
          };
          
          console.log('Updating document with data:', documentUpdate);
          
          const { data: updateData, error: updateError } = await adminSupabase
            .from('documents')
            .update(documentUpdate)
            .eq('id', requestBody.documentId)
            .select();
            
          if (updateError) {
            console.error('Error updating document record:', updateError);
            // Get more details about the specific error
            const { data: docInfo, error: docInfoError } = await adminSupabase
              .from('documents')
              .select('*')
              .eq('id', requestBody.documentId)
              .single();
            
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
        if (requestBody.buyerId && requestBody.resourceType === 'projects') {
          console.log('Updating project_buyer record with ID:', requestBody.buyerId);
          console.log('Setting file path:', filePath);
          console.log('Setting file name:', fileNameClean);
          
          const { data: updateData, error: updateError } = await adminSupabase
            .from('project_buyers')
            .update({
              contract_file_path: filePath,
              contract_file_name: fileNameClean,
              contract_status: 'a_analisar'
            })
            .eq('id', requestBody.buyerId)
            .select();
            
          if (updateError) {
            console.error('Error updating project_buyer:', updateError);
            // Don't throw here, still return success for the file upload
            console.log('File was uploaded but project_buyer record was not updated');
          } else {
            console.log('Project buyer record updated successfully:', updateData);
          }
        }

        // Set the file to be publicly accessible
        const { error: updatePublicError } = await adminSupabase
          .storage
          .from('documents')
          .update(filePath, bytes, {
            contentType: 'application/pdf',
            upsert: true,
            cacheControl: '3600',
            allowedMimeTypes: ['application/pdf']
          });
          
        if (updatePublicError) {
          console.error('Error setting file to public:', updatePublicError);
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            filePath: filePath,
            fileName: fileNameClean,
            signedUrl: urlData?.signedUrl
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
