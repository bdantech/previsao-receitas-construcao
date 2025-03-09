
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

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
    // Obter URL da Supabase e chave anônima das variáveis de ambiente
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('As variáveis de ambiente SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórias')
    }

    // Inicializar cliente do Supabase
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Extrair o corpo da requisição
    const { action, email, password, companyData, isAdmin } = await req.json()

    // Função para processar a requisição de registro de usuário de empresa
    if (action === 'register_company_user') {
      if (!email || !password || !companyData) {
        throw new Error('Email, senha e dados da empresa são obrigatórios')
      }

      // 1. Registrar o usuário
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError

      const userId = authData.user?.id
      if (!userId) throw new Error('Falha ao criar usuário')

      // 2. Criar a empresa
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: companyData.name,
          cnpj: companyData.cnpj,
          website: companyData.website || null
        })
        .select('id')
        .single()

      if (companyError) throw companyError

      // 3. Relacionar o usuário com a empresa
      const { error: relationError } = await supabase
        .from('user_companies')
        .insert({
          user_id: userId,
          company_id: companyData.id
        })

      if (relationError) throw relationError

      return new Response(
        JSON.stringify({ 
          message: 'Usuário de empresa registrado com sucesso',
          userId: userId
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 201 
        }
      )
    }

    // Função para processar a requisição de registro de usuário administrador
    if (action === 'register_admin_user') {
      // Verificar se o usuário atual é um administrador
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Autenticação necessária' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401 
          }
        )
      }

      const { data: currentUserProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      if (currentUserProfile.role !== 'admin') {
        return new Response(
          JSON.stringify({ error: 'Apenas administradores podem criar outros administradores' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403 
          }
        )
      }

      // Registrar o novo administrador
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

      if (authError) throw authError

      // Atualizar o perfil para definir como administrador
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', authData.user.id)

      if (updateError) throw updateError

      return new Response(
        JSON.stringify({ 
          message: 'Usuário administrador criado com sucesso',
          userId: authData.user.id
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 201 
        }
      )
    }

    // Função para processar a requisição de login
    if (action === 'login') {
      if (!email || !password) {
        throw new Error('Email e senha são obrigatórios')
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Verificar o papel do usuário
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      if (profileError) throw profileError

      return new Response(
        JSON.stringify({ 
          user: data.user,
          session: data.session,
          role: profile.role 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Se não for nenhuma ação reconhecida
    return new Response(
      JSON.stringify({ error: 'Ação inválida' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
