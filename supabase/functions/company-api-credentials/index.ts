
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

// CORS configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables')
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    // Initialize Supabase clients
    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey
    )

    const reqClient = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        global: {
          headers: {
            Authorization: authHeader
          },
        },
      }
    )

    // Authenticate user
    const { data: { user }, error: authError } = await reqClient.auth.getUser()
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    // Parse request
    const { action, companyId } = await req.json()

    // Check if user has access to the company
    const { data: userCompany, error: userCompanyError } = await reqClient
      .from('user_companies')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .single()

    const { data: userProfile, error: userProfileError } = await reqClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = userProfile?.role === 'admin'
    
    if (!isAdmin && (userCompanyError || !userCompany)) {
      return new Response(
        JSON.stringify({ error: 'Access denied to this company' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403 
        }
      )
    }

    // Handle different actions
    if (action === 'getCredentials') {
      // Get company API credentials
      const { data, error } = await reqClient
        .from('company_api_credentials')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
      
      if (error) {
        throw error
      }
      
      return new Response(
        JSON.stringify({ credentials: data }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }
    else if (action === 'generateCredentials') {
      // Deactivate any existing active credentials
      await reqClient
        .from('company_api_credentials')
        .update({ active: false })
        .eq('company_id', companyId)
        .eq('active', true)
      
      // Generate new client_id and client_secret
      const clientId = crypto.randomUUID()
      
      // Generate a secure random string for client_secret
      const randomBytes = new Uint8Array(32)
      crypto.getRandomValues(randomBytes)
      const clientSecret = Array.from(randomBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
      
      // Insert new credentials
      const { data, error } = await reqClient
        .from('company_api_credentials')
        .insert({
          company_id: companyId,
          client_id: clientId,
          client_secret: clientSecret,
          created_by: user.id,
        })
        .select()
        .single()
      
      if (error) {
        throw error
      }
      
      return new Response(
        JSON.stringify({ 
          credential: {
            ...data,
            client_id: clientId,
            client_secret: clientSecret
          } 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }
    else if (action === 'deactivateCredentials') {
      const { credentialId } = await req.json()
      
      // Deactivate the credential
      const { data, error } = await reqClient
        .from('company_api_credentials')
        .update({ active: false })
        .eq('id', credentialId)
        .eq('company_id', companyId)
        .select()
        .single()
      
      if (error) {
        throw error
      }
      
      return new Response(
        JSON.stringify({ success: true, credential: data }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }
    else {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
