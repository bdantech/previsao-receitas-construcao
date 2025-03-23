
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

// CORS configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Function to validate a CPF number
function isValidCPF(cpf: string): boolean {
  // Remove non-numeric characters
  cpf = cpf.replace(/\D/g, '');
  
  // Check if the length is 11 digits
  if (cpf.length !== 11) {
    return false;
  }
  
  // Check if all digits are the same
  if (/^(\d)\1+$/.test(cpf)) {
    return false;
  }
  
  // Calculate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i);
  }
  
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  
  if (remainder !== parseInt(cpf.charAt(9))) {
    return false;
  }
  
  // Calculate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  
  if (remainder !== parseInt(cpf.charAt(10))) {
    return false;
  }
  
  return true;
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

    // Get authorization header for Basic Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return new Response(
        JSON.stringify({ error: 'Basic authentication required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    // Decode base64 credentials
    const base64Credentials = authHeader.split(' ')[1]
    const credentials = atob(base64Credentials).split(':')
    const clientId = credentials[0]
    const clientSecret = credentials[1]

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials format' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    // Initialize Supabase client with service role key (bypasses RLS)
    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey
    )

    // Check if API credentials are valid
    const { data: apiCredential, error: apiCredentialError } = await supabase
      .from('company_api_credentials')
      .select('*, companies:company_id(id, name)')
      .eq('client_id', clientId)
      .eq('client_secret', clientSecret)
      .eq('active', true)
      .single()

    if (apiCredentialError || !apiCredential) {
      console.error('API credential error:', apiCredentialError)
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive API credentials' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    const companyId = apiCredential.company_id

    // Only handle POST requests for creating receivables
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 405 
        }
      )
    }

    // Parse request body
    const requestData = await req.json()

    // Validate required fields
    if (!requestData.projectId || !requestData.receivables || !Array.isArray(requestData.receivables)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    // Check if project exists and belongs to the company
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', requestData.projectId)
      .eq('company_id', companyId)
      .single()

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ 
          error: 'Project not found or does not belong to this company',
          details: projectError?.message
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      )
    }

    // Process receivables
    const receivables = requestData.receivables
    const results = {
      success: [] as any[],
      errors: [] as any[]
    }

    for (const receivable of receivables) {
      try {
        // Validate required fields
        if (!receivable.buyerName || !receivable.buyerCpf || !receivable.amount || !receivable.dueDate) {
          results.errors.push({
            receivable,
            error: 'Missing required fields'
          })
          continue
        }

        // Validate CPF
        const cleanCpf = receivable.buyerCpf.replace(/\D/g, '')
        if (!isValidCPF(cleanCpf)) {
          results.errors.push({
            receivable,
            error: 'Invalid CPF'
          })
          continue
        }

        // Validate amount is a number
        const amount = parseFloat(receivable.amount)
        if (isNaN(amount) || amount <= 0) {
          results.errors.push({
            receivable,
            error: 'Invalid amount'
          })
          continue
        }

        // Validate due date is in the future
        const dueDate = new Date(receivable.dueDate)
        if (isNaN(dueDate.getTime()) || dueDate <= new Date()) {
          results.errors.push({
            receivable,
            error: 'Invalid due date or date is not in the future'
          })
          continue
        }

        // Check if project has a buyer with this CPF
        let buyerStatus = null
        const { data: buyer } = await supabase
          .from('project_buyers')
          .select('buyer_status')
          .eq('project_id', requestData.projectId)
          .eq('cpf', cleanCpf)
          .single()

        if (buyer) {
          buyerStatus = buyer.buyer_status
        }

        // Determine initial status based on buyer status
        let initialStatus = 'enviado' as string
        if (buyerStatus === 'aprovado') {
          initialStatus = 'elegivel_para_antecipacao'
        } else if (buyerStatus === 'reprovado') {
          initialStatus = 'reprovado'
        }

        // Insert receivable
        const { data: newReceivable, error: receivableError } = await supabase
          .from('receivables')
          .insert({
            project_id: requestData.projectId,
            buyer_name: receivable.buyerName,
            buyer_cpf: cleanCpf,
            amount: amount,
            due_date: receivable.dueDate,
            description: receivable.description || null,
            status: initialStatus,
            created_by: apiCredential.created_by // Use the user who created the API credential
          })
          .select()
          .single()

        if (receivableError) {
          console.error('Error creating receivable:', receivableError)
          results.errors.push({
            receivable,
            error: receivableError.message
          })
          continue
        }

        results.success.push(newReceivable)
      } catch (error) {
        console.error('Error processing receivable:', error)
        results.errors.push({
          receivable,
          error: error.message
        })
      }
    }

    return new Response(
      JSON.stringify({
        project: {
          id: project.id,
          name: project.name
        },
        results: {
          total: receivables.length,
          success: results.success.length,
          errors: results.errors.length,
          successRecords: results.success,
          errorRecords: results.errors
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
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
