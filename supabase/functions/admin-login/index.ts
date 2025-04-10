import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
// Configuração CORS para permitir chamadas do frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  // Tratamento para requisições OPTIONS (preflight CORS)
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    // Obter URL da Supabase e chave anônima das variáveis de ambiente
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('As variáveis de ambiente SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórias');
    }
    // Inicializar cliente do Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);
    // Extrair o corpo da requisição
    const { email, password } = await req.json();
    if (!email || !password) {
      throw new Error('Email e senha são obrigatórios');
    }
    // Autenticar o usuário
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    // Verificar se o usuário é um administrador
    // const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
    // if (profileError) throw profileError;
    // if (profile.role !== 'admin') {
    //   return new Response(JSON.stringify({
    //     error: 'Acesso negado: Apenas administradores podem acessar este portal'
    //   }), {
    //     headers: {
    //       ...corsHeaders,
    //       'Content-Type': 'application/json'
    //     },
    //     status: 403
    //   });
    // }
    return new Response(JSON.stringify({
      user: data.user,
      session: data.session
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
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
