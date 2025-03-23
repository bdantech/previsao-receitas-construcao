
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Create a Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Basic Auth handling
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return new Response(JSON.stringify({ error: 'Credenciais não fornecidas' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Extract credentials from Basic Auth
    const base64Credentials = authHeader.split(' ')[1]
    const credentials = atob(base64Credentials).split(':')
    const clientId = credentials[0]
    const clientSecret = credentials[1]

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: 'Credenciais inválidas' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify credentials
    const { data: credentialData, error: credentialError } = await supabase
      .from('company_api_credentials')
      .select('company_id')
      .eq('client_id', clientId)
      .eq('client_secret', clientSecret)
      .eq('active', true)
      .single()

    if (credentialError || !credentialData) {
      return new Response(JSON.stringify({ error: 'Credenciais inválidas ou inativas' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const companyId = credentialData.company_id

    if (req.method === 'POST') {
      const { data: reqData } = await req.json()
      
      // Validate required fields
      if (!reqData.project_id || !reqData.receivables || !Array.isArray(reqData.receivables) || reqData.receivables.length === 0) {
        return new Response(JSON.stringify({ error: 'Dados incompletos ou inválidos' }), {
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      // Verify project belongs to company
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .eq('id', reqData.project_id)
        .eq('company_id', companyId)
        .single()
        
      if (projectError || !projectData) {
        return new Response(JSON.stringify({ error: 'Projeto não encontrado ou não pertence a esta empresa' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      const projectId = reqData.project_id
      const receivablesToInsert = []
      const errors = []
      
      // Prepare receivables for insertion
      for (const receivable of reqData.receivables) {
        // Validate required fields
        if (!receivable.buyer_name || !receivable.buyer_cpf || !receivable.amount || !receivable.due_date) {
          errors.push({
            receivable,
            error: 'Campos obrigatórios ausentes: buyer_name, buyer_cpf, amount, due_date são obrigatórios'
          })
          continue
        }
        
        try {
          // Format and validate amount
          const amount = typeof receivable.amount === 'string' 
            ? parseFloat(receivable.amount.replace(/[^\d.,]/g, '').replace(',', '.'))
            : Number(receivable.amount)
            
          if (isNaN(amount) || amount <= 0) {
            errors.push({
              receivable,
              error: 'Valor inválido'
            })
            continue
          }
          
          // Validate and format due_date
          let dueDate
          try {
            dueDate = new Date(receivable.due_date)
            if (isNaN(dueDate.getTime())) {
              throw new Error('Data inválida')
            }
          } catch (e) {
            errors.push({
              receivable,
              error: 'Data de vencimento inválida'
            })
            continue
          }
          
          // Clean CPF
          const buyerCpf = receivable.buyer_cpf.replace(/\D/g, '')
          
          // Check if there's a buyer entry, determine initial status
          const { data: statusData, error: statusError } = await supabase.rpc(
            'get_initial_receivable_status',
            { project_id: projectId, buyer_cpf: buyerCpf }
          )
          
          const status = statusError ? 'enviado' : statusData || 'enviado'
          
          // Prepare receivable for insertion
          receivablesToInsert.push({
            project_id: projectId,
            buyer_name: receivable.buyer_name,
            buyer_cpf: buyerCpf,
            amount: amount,
            due_date: dueDate.toISOString().split('T')[0],
            description: receivable.description || '',
            external_id: receivable.external_id || null,
            status: status
          })
        } catch (e) {
          errors.push({
            receivable,
            error: `Erro ao processar: ${e.message}`
          })
        }
      }
      
      // Insert valid receivables
      let insertedCount = 0
      if (receivablesToInsert.length > 0) {
        const { data: insertedData, error: insertError } = await supabase
          .from('receivables')
          .insert(receivablesToInsert)
          .select()
        
        if (insertError) {
          return new Response(JSON.stringify({ 
            error: 'Erro ao inserir recebíveis', 
            details: insertError.message,
            processed: insertedCount,
            errors
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        
        insertedCount = insertedData?.length || 0
      }
      
      // Prepare response
      const response = {
        success: true,
        message: `${insertedCount} recebíveis processados com sucesso`,
        processed: insertedCount,
        total: reqData.receivables.length,
        errors: errors.length > 0 ? errors : null
      }
      
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
