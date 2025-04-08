import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { generateSignature } from './ecdsa.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Initialize service role client for admin operations
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { 
        auth: { 
          autoRefreshToken: true,
          persistSession: true 
        } 
      }
    );

    // Extract the token and verify the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Verify user is an admin by checking the role in profiles table
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Parse request body
    const requestBody = await req.json();
    console.log('Request body:', requestBody);
    
    const { action, data } = requestBody;
    const { boletoId } = data || {};
    console.log('Action:', action);
    console.log('Boleto ID:', boletoId);

    if (action !== 'emitirBoleto') {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get boleto data
    const { data: boleto, error: boletoError } = await adminSupabase
      .from('boletos')
      .select('*')
      .eq('id', boletoId)
      .single();

    if (boletoError || !boleto) {
      return new Response(
        JSON.stringify({ error: 'Boleto not found', details: boletoError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Get bank account data using project_id
    const { data: bankAccount, error: bankError } = await adminSupabase
      .from('bank_accounts')
      .select('*')
      .eq('project_id', boleto.project_id)
      .single();

    if (bankError || !bankAccount) {
      console.error('Bank account error:', bankError);
      return new Response(
        JSON.stringify({ error: 'Bank account not found', details: bankError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Create boleto using Starkbank REST API
    const starkbankApiUrl = 'https://sandbox.api.starkbank.com/v2/boleto';
    const privateKey = bankAccount.private_key;
    const bankProjectId = bankAccount.bank_project_id;

    // Create the Starkbank request body
    const boletoData = {
      amount: Math.round(boleto.valor_boleto * 100), // Convert to cents
      name: "NOME TESTE",
      taxId: boleto.payer_tax_id,
      streetLine1: "Av. Faria Lima, 1844",
      streetLine2: "CJ 13",
      district: "Itaim Bibi",
      city: "São Paulo",
      stateCode: "SP",
      zipCode: "01500-000",
      due: boleto.data_vencimento.split('T')[0],
      fine: 2.0,
      interest: 1.0,
      overdueLimit: 15,
    };

    // Wrap in boletos key as required by the API
    const starkbankRequestBody = {
      boletos: [boletoData]
    };

    // Convert to JSON string
    const jsonBody = JSON.stringify(starkbankRequestBody);
    console.log('Request body:', jsonBody);

    // Get current time in Unix timestamp format (seconds since epoch)
    const accessTime = Math.floor(Date.now() / 1000).toString();

    // Generate the message to sign (following Starkbank's format)
    const accessId = `project/${bankProjectId}`;
    const message = `${accessId}:${accessTime}:${jsonBody}`;
    console.log('Message to sign:', message);
    
    try {
      // Generate the signature
      const signature = await generateSignature(message, privateKey);

      // Make the API request
      const response = await fetch(starkbankApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Access-Id': accessId,
          'Access-Time': accessTime,
          'Access-Signature': signature,
          'User-Agent': 'Mozilla/5.0',
        },
        body: jsonBody,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Starkbank API error:', errorData);
        return new Response(
          JSON.stringify({ error: 'Failed to create boleto in Starkbank', details: errorData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: response.status }
        );
      }

      const starkbankBoleto = await response.json();
      console.log('Starkbank response:', JSON.stringify(starkbankBoleto, null, 2));
      
      // Since Starkbank returns an array of boletos, get the first one
      const createdBoleto = Array.isArray(starkbankBoleto.boletos) ? starkbankBoleto.boletos[0] : starkbankBoleto;
      console.log('Created boleto:', JSON.stringify(createdBoleto, null, 2));
      
      // Add detailed logging of the specific fields and response structure
      console.log('Response keys:', Object.keys(createdBoleto));
      console.log('ID:', createdBoleto.id);
      console.log('Line:', createdBoleto.line);
      
      // Check for our_number field with different possible formats
      console.log('Our Number (our_number):', createdBoleto.our_number);
      console.log('Our Number (ourNumber):', createdBoleto.ourNumber);
      console.log('Our Number (numero):', createdBoleto.numero);
      console.log('Our Number (number):', createdBoleto.number);
      
      // Determine the appropriate value for nosso_numero
      let nossoNumero = null;
      if (createdBoleto.our_number) {
        nossoNumero = createdBoleto.our_number;
        console.log('Using our_number:', nossoNumero);
      } else if (createdBoleto.ourNumber) {
        nossoNumero = createdBoleto.ourNumber;
        console.log('Using ourNumber:', nossoNumero);
      } else if (createdBoleto.numero) {
        nossoNumero = createdBoleto.numero;
        console.log('Using numero:', nossoNumero);
      } else if (createdBoleto.number) {
        nossoNumero = createdBoleto.number;
        console.log('Using number:', nossoNumero);
      } else {
        console.log('No suitable field found for nosso_numero');
      }
      
      // Update boleto status and details
      const updateData: {
        status_emissao: string;
        status_pagamento: string;
        linha_digitavel: string;
        external_id: string;
        nosso_numero?: string;
      } = {
        status_emissao: 'Emitido',
        status_pagamento: 'Em Aberto',
        linha_digitavel: createdBoleto.line,
        external_id: createdBoleto.id
      };
      
      // Only add nosso_numero if we found a value
      if (nossoNumero) {
        updateData.nosso_numero = nossoNumero;
      }
      
      console.log('Update data:', JSON.stringify(updateData, null, 2));

      const { error: updateError } = await adminSupabase
        .from('boletos')
        .update(updateData)
        .eq('id', boletoId);

      if (updateError) {
        console.error('Update error:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update boleto status', details: updateError }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      return new Response(
        JSON.stringify({ message: 'Boleto created successfully', data: createdBoleto }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );

    } catch (error) {
      console.error('Error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to generate signature', details: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}); 