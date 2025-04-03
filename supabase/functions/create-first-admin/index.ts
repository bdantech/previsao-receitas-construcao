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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('As variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias');
    }
    // Inicializar cliente do Supabase com service role
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    // Setup a secure admin account with hardcoded email and password
    const email = "admin@onepay.com";
    const password = "admin123";
    // Check if admin already exists
    const { data: existingUsers, error: checkError } = await adminSupabase.from('profiles').select('id').eq('role', 'admin').limit(1);
    if (checkError) throw checkError;
    if (existingUsers && existingUsers.length > 0) {
      return new Response(JSON.stringify({
        message: 'Admin já existe no sistema'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
    // Create admin user
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (authError) throw authError;
    // Update profile to set as admin
    const { error: updateError } = await adminSupabase.from('profiles').update({
      role: 'admin'
    }).eq('id', authData.user.id);
    if (updateError) {
      // Try to clean up if setting role fails
      await adminSupabase.auth.admin.deleteUser(authData.user.id);
      throw updateError;
    }
    return new Response(JSON.stringify({
      message: 'Admin criado com sucesso',
      email: email,
      password: password
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 201
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
