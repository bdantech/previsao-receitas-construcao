
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

// CORS configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

serve(async (req) => {
  // Handle preflight CORS requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get Supabase environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing environment variables SUPABASE_URL or SUPABASE_ANON_KEY')
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization not provided' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    // Initialize authenticated Supabase client with user's token
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseKey,
      {
        global: {
          headers: {
            Authorization: authHeader
          },
        },
      }
    )

    // Verify the user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: authError?.message || 'Authentication required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    // Get user profile to determine role
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      return new Response(
        JSON.stringify({ error: 'Error retrieving user profile' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    const isAdmin = profile.role === 'admin'
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    const operation = pathParts[1] // e.g., /document-management/document-types

    // Handle different operations
    if (operation === 'document-types') {
      // Get all document types (both admin and company users can view)
      if (req.method === 'GET') {
        const { data, error } = await supabaseClient
          .from('document_types')
          .select('*')
          .order('name')

        if (error) throw error

        return new Response(
          JSON.stringify({ documentTypes: data }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        )
      }
      // Create new document type (admin only)
      else if (req.method === 'POST' && isAdmin) {
        const requestData = await req.json()
        const { name, resource, description, required } = requestData

        const { data, error } = await supabaseClient
          .from('document_types')
          .insert({
            name,
            resource,
            description,
            required: required || false
          })
          .select()
          .single()

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, documentType: data }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 201 
          }
        )
      }
    }
    else if (operation === 'documents') {
      // Get documents
      if (req.method === 'GET') {
        let query = supabaseClient
          .from('documents')
          .select(`
            *,
            document_type:document_type_id(id, name, resource, description, required),
            submitter:submitted_by(id, email),
            reviewer:reviewed_by(id, email)
          `)

        // Apply filter for company users - they can only see their company's documents
        if (!isAdmin) {
          // Get user's companies
          const { data: userCompanies } = await supabaseClient
            .from('user_companies')
            .select('company_id')
            .eq('user_id', user.id)

          if (!userCompanies || userCompanies.length === 0) {
            return new Response(
              JSON.stringify({ documents: [] }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200 
              }
            )
          }

          const companyIds = userCompanies.map(uc => uc.company_id)
          query = query
            .eq('resource_type', 'company')
            .in('resource_id', companyIds)
        }

        // Apply additional filters if provided in the URL
        const resourceType = url.searchParams.get('resourceType')
        const resourceId = url.searchParams.get('resourceId')
        const status = url.searchParams.get('status')

        if (resourceType) query = query.eq('resource_type', resourceType)
        if (resourceId) query = query.eq('resource_id', resourceId)
        if (status) query = query.eq('status', status)

        // Execute the query
        const { data, error } = await query.order('submitted_at', { ascending: false })

        if (error) throw error

        return new Response(
          JSON.stringify({ documents: data }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        )
      }
      // Update document status (admin only for approval/rejection)
      else if (req.method === 'PUT') {
        const requestData = await req.json()
        const { id, status, reviewNotes } = requestData

        if (isAdmin) {
          // Admins can update status to 'approved' or 'needs_revision'
          if (status !== 'approved' && status !== 'needs_revision') {
            return new Response(
              JSON.stringify({ error: 'Invalid status. Admins can only set status to approved or needs_revision' }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400 
              }
            )
          }

          const { data, error } = await supabaseClient
            .from('documents')
            .update({
              status,
              review_notes: reviewNotes,
              reviewed_by: user.id,
              reviewed_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single()

          if (error) throw error

          return new Response(
            JSON.stringify({ success: true, document: data }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200 
            }
          )
        } else {
          // Company users can only update documents with 'needs_revision' status to 'sent'
          if (status !== 'sent') {
            return new Response(
              JSON.stringify({ error: 'Company users can only resubmit documents (setting status to sent)' }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400 
              }
            )
          }

          // Verify the document belongs to one of the user's companies and has 'needs_revision' status
          const { data: document, error: getError } = await supabaseClient
            .from('documents')
            .select('*')
            .eq('id', id)
            .eq('status', 'needs_revision')
            .single()

          if (getError) {
            return new Response(
              JSON.stringify({ error: 'Document not found or not eligible for update' }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 404 
              }
            )
          }

          // Verify user belongs to the document's company
          const { data: userCompanies, error: companyError } = await supabaseClient
            .from('user_companies')
            .select('company_id')
            .eq('user_id', user.id)
            .eq('company_id', document.resource_id)

          if (companyError || !userCompanies.length) {
            return new Response(
              JSON.stringify({ error: 'You do not have permission to update this document' }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 403 
              }
            )
          }

          // Update the document
          const { data, error } = await supabaseClient
            .from('documents')
            .update({
              status: 'sent',
              submitted_at: new Date().toISOString(),
              reviewed_by: null,
              reviewed_at: null,
              review_notes: null
            })
            .eq('id', id)
            .select()
            .single()

          if (error) throw error

          return new Response(
            JSON.stringify({ success: true, document: data }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200 
            }
          )
        }
      }
      // Submit new document
      else if (req.method === 'POST') {
        const requestData = await req.json()
        const { 
          documentTypeId, 
          resourceType, 
          resourceId, 
          filePath, 
          fileName, 
          fileSize, 
          mimeType 
        } = requestData

        // If user is not admin, verify they belong to the company
        if (!isAdmin && resourceType === 'company') {
          const { data: userCompanies, error: companyError } = await supabaseClient
            .from('user_companies')
            .select('company_id')
            .eq('user_id', user.id)
            .eq('company_id', resourceId)

          if (companyError || !userCompanies.length) {
            return new Response(
              JSON.stringify({ error: 'You do not have permission to submit documents for this company' }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 403 
              }
            )
          }
        }

        // Create new document
        const { data, error } = await supabaseClient
          .from('documents')
          .insert({
            document_type_id: documentTypeId,
            resource_type: resourceType,
            resource_id: resourceId,
            status: 'sent',
            file_path: filePath,
            file_name: fileName,
            file_size: fileSize,
            mime_type: mimeType,
            submitted_by: user.id
          })
          .select()
          .single()

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, document: data }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 201 
          }
        )
      }
    }

    // If we get here, the operation or method is not supported
    return new Response(
      JSON.stringify({ error: 'Operation not supported' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )

  } catch (error) {
    console.error('Error in document-management function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
