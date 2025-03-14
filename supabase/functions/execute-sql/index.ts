
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { Pool } from 'https://deno.land/x/postgres@v0.17.0/mod.ts'

// Configuração CORS para permitir chamadas do frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Tratamento para requisições OPTIONS (preflight CORS)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verificar se o banco de dados está configurado
    const databaseUrl = Deno.env.get('SUPABASE_DB_URL')
    if (!databaseUrl) {
      throw new Error('Database connection string not found')
    }
    
    // Get authorization header for user authentication
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
    
    // Criar pool de conexões
    const pool = new Pool(databaseUrl, 3, true)
    
    // Parse request body
    const { query_text, params } = await req.json()
    
    if (!query_text) {
      throw new Error('Query text is required')
    }
    
    // Conectar ao banco de dados
    const connection = await pool.connect()
    
    try {
      // Executar a query
      const result = await connection.queryObject({
        text: query_text,
        args: params || []
      })
      
      // Retornar o resultado
      return new Response(
        JSON.stringify(result.rows),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    } finally {
      // Liberar a conexão de volta para o pool
      connection.release()
    }
  } catch (error) {
    console.error('Error executing SQL:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
