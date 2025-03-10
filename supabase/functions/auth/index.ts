import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

// Configuração CORS para permitir chamadas do frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')
      throw new Error('As variáveis de ambiente SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórias')
    }

    // Inicializar cliente do Supabase
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Inicializar cliente do Supabase com service role (para operações administrativas)
    const adminSupabase = supabaseServiceKey ? 
      createClient(supabaseUrl, supabaseServiceKey) : 
      null;

    if (!adminSupabase) {
      console.error('Service role key is not available')
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta: chave de serviço indisponível' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }

    // Log da requisição para debugging
    console.log('Received request:', req.method, req.url)
    
    // Extrair o corpo da requisição
    let requestData
    try {
      requestData = await req.json()
      console.log('Request data:', JSON.stringify(requestData))
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body: ' + e.message }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }
    
    const { action, email, password } = requestData
    
    // Função para processar a requisição de registro de usuário de empresa
    if (action === 'register_company_user') {
      console.log('Processing register_company_user action')
      // Verificar se todos os campos necessários estão presentes
      const { companyData } = requestData
      
      if (!email || !password || !companyData) {
        return new Response(
          JSON.stringify({ error: 'Email, senha e dados da empresa são obrigatórios' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }

      // Verificar se o service role está disponível
      if (!adminSupabase) {
        console.error('Service role key is not available')
        return new Response(
          JSON.stringify({ error: 'Configuração do servidor incompleta: chave de serviço indisponível' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        )
      }

      // Validar campos da empresa
      if (!companyData.name || !companyData.cnpj) {
        return new Response(
          JSON.stringify({ error: 'Nome da empresa e CNPJ são obrigatórios' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }

      // Validar email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        console.error('Invalid email format:', email)
        return new Response(
          JSON.stringify({ error: 'Email inválido. Por favor, forneça um email válido.' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }

      try {
        // 1. Verificar se já existe usuário com este email
        const { data: existingUser, error: existingUserError } = await adminSupabase.auth.admin.listUsers()
        if (existingUserError) {
          console.error('Error checking existing user:', existingUserError)
          return new Response(
            JSON.stringify({ error: 'Erro ao verificar usuário existente' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500 
            }
          )
        }

        if (existingUser.users.some(u => u.email === email)) {
          return new Response(
            JSON.stringify({ error: 'Este email já está em uso' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          )
        }

        // 2. Verificar se já existe empresa com este CNPJ
        const { data: existingCompany, error: existingCompanyError } = await adminSupabase
          .from('companies')
          .select('id')
          .eq('cnpj', companyData.cnpj)
          .single()

        if (existingCompanyError && existingCompanyError.code !== 'PGRST116') {
          console.error('Error checking existing company:', existingCompanyError)
          return new Response(
            JSON.stringify({ error: 'Erro ao verificar empresa existente' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500 
            }
          )
        }

        if (existingCompany) {
          return new Response(
            JSON.stringify({ error: 'Já existe uma empresa cadastrada com este CNPJ' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          )
        }

        // 3. Registrar o usuário
        console.log('Registering user with email:', email)
        const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true
        })

        if (authError) {
          console.error('Auth error:', authError)
          return new Response(
            JSON.stringify({ error: authError.message }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          )
        }

        const userId = authData.user?.id
        if (!userId) {
          throw new Error('Falha ao criar usuário')
        }

        // 4. Criar a empresa usando o service role que ignora RLS
        console.log('Creating company with service role:', companyData.name)
        const { data: companyResult, error: companyError } = await adminSupabase
          .from('companies')
          .insert({
            name: companyData.name,
            cnpj: companyData.cnpj,
            website: companyData.website || null
          })
          .select('id')
          .single()

        if (companyError) {
          console.error('Company error:', companyError)
          // Tentar remover o usuário já que a criação da empresa falhou
          await adminSupabase.auth.admin.deleteUser(userId)
          return new Response(
            JSON.stringify({ error: companyError.message }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          )
        }

        // 5. Relacionar o usuário com a empresa usando o service role
        console.log('Linking user to company using service role')
        const { error: relationError } = await adminSupabase
          .from('user_companies')
          .insert({
            user_id: userId,
            company_id: companyResult.id
          })

        if (relationError) {
          console.error('Relation error:', relationError)
          // Tentar limpar os dados já que a relação falhou
          await adminSupabase.auth.admin.deleteUser(userId)
          await adminSupabase.from('companies').delete().eq('id', companyResult.id)
          return new Response(
            JSON.stringify({ error: relationError.message }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          )
        }

        // 6. Criar documentos iniciais para a empresa manualmente, agora usando status 'not_sent'
        console.log('Creating initial documents for company')
        
        // First, check if ANY documents exist for this company
        const { data: existingDocs, error: existingDocsError } = await adminSupabase
          .from('documents')
          .select('id')
          .eq('resource_type', 'company')
          .eq('resource_id', companyResult.id)

        if (existingDocsError) {
          console.error('Error checking existing documents:', existingDocsError)
        } else if (existingDocs && existingDocs.length > 0) {
          console.log('Documents already exist for this company, skipping creation')
        } else {
          // Only proceed with document creation if NO documents exist
          const { data: docTypes, error: docTypesError } = await adminSupabase
            .from('document_types')
            .select('id, name')
            .eq('resource', 'company')
          
          if (docTypesError) {
            console.error('Error fetching document types:', docTypesError)
          } else if (docTypes && docTypes.length > 0) {
            try {
              const documentInserts = docTypes.map(docType => ({
                document_type_id: docType.id,
                resource_type: 'company',
                resource_id: companyResult.id,
                status: 'not_sent',
                file_path: '',
                file_name: `Pending Upload - ${docType.name}`,
                submitted_by: null,
                submitted_at: null,
                reviewed_by: null,
                reviewed_at: null,
                review_notes: null
              }))

              const { error: docsError } = await adminSupabase
                .from('documents')
                .insert(documentInserts)

              if (docsError) {
                console.error('Error creating initial documents:', docsError)
                console.error('Error details:', JSON.stringify(docsError))
              } else {
                console.log('Initial documents created successfully')
              }
            } catch (docError) {
              console.error('Exception creating documents:', docError)
            }
          }
        }

        console.log('Company user registered successfully')
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
      } catch (error) {
        console.error('Unexpected error:', error)
        return new Response(
          JSON.stringify({ error: error.message }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        )
      }
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

      // Verificar se o service role está disponível
      if (!adminSupabase) {
        console.error('Service role key is not available')
        return new Response(
          JSON.stringify({ error: 'Configuração do servidor incompleta: chave de serviço indisponível' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        )
      }

      try {
        const { data: currentUserProfile, error: profileError } = await adminSupabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profileError) {
          console.error('Profile error:', profileError)
          return new Response(
            JSON.stringify({ error: profileError.message }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          )
        }

        if (currentUserProfile.role !== 'admin') {
          return new Response(
            JSON.stringify({ error: 'Apenas administradores podem criar outros administradores' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 403 
            }
          )
        }

        // Registrar o novo administrador usando o service role
        const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        })

        if (authError) {
          console.error('Auth error:', authError)
          return new Response(
            JSON.stringify({ error: authError.message }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          )
        }

        // Atualizar o perfil para definir como administrador
        const { error: updateError } = await adminSupabase
          .from('profiles')
          .update({ role: 'admin' })
          .eq('id', authData.user.id)

        if (updateError) {
          console.error('Update error:', updateError)
          // Tentar remover o usuário já que a atualização do perfil falhou
          await adminSupabase.auth.admin.deleteUser(authData.user.id)
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          )
        }

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
      } catch (error) {
        console.error('Unexpected error:', error)
        return new Response(
          JSON.stringify({ error: error.message }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        )
      }
    }

    // Função para processar a requisição de login
    if (action === 'login') {
      console.log('Processing login action for email:', email)
      
      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: 'Email e senha são obrigatórios' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }

      try {
        // First sign in the user
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          console.error('Login error:', error)
          return new Response(
            JSON.stringify({ error: error.message }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          )
        }

        console.log('User logged in successfully, fetching profile')

        // Use the admin supabase to get the user's profile
        const { data: profile, error: profileError } = await adminSupabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single()

        if (profileError) {
          console.error('Profile fetch error:', profileError)
          return new Response(
            JSON.stringify({ error: profileError.message }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          )
        }

        console.log('User profile fetched successfully:', profile)
        console.log('User role:', profile.role)

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
      } catch (error) {
        console.error('Unexpected error during login:', error)
        return new Response(
          JSON.stringify({ error: error.message }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        )
      }
    }

    // Se não for nenhuma ação reconhecida
    return new Response(
      JSON.stringify({ error: 'Ação inválida: ' + action }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )

  } catch (error) {
    console.error('Error in edge function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
