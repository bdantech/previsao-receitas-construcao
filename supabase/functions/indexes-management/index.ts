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

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Create authenticated client
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

    // Verify user is authenticated
    const { data: { user }, error: userError } = await reqClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Create service client (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the user role
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'Error verifying user permissions' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const isAdmin = profileData.role === 'admin'
    const requestData = await req.json()
    const { action, data } = requestData

    // Handle different actions based on user role
    switch (action) {
      // ===== Index Operations =====
      case 'getIndexes':
        // Both admin and company users can read indexes
        console.log('Getting indexes')
        const { data: indexes, error: indexesError } = await supabase
          .from('indexes')
          .select('*')
          .order('name')

        if (indexesError) {
          console.error('Error fetching indexes:', indexesError)
          return new Response(
            JSON.stringify({ error: 'Error fetching indexes' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }

        return new Response(
          JSON.stringify({ indexes }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

      case 'createIndex':
        // Only admin can create indexes
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: 'Only admin users can create indexes' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
          )
        }

        console.log('Creating index:', data)
        const { data: newIndex, error: createError } = await supabase
          .from('indexes')
          .insert({
            name: data.name,
            description: data.description
          })
          .select()
          .single()

        if (createError) {
          console.error('Error creating index:', createError)
          return new Response(
            JSON.stringify({ error: 'Error creating index' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }

        return new Response(
          JSON.stringify({ index: newIndex }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
        )

      case 'updateIndex':
        // Only admin can update indexes
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: 'Only admin users can update indexes' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
          )
        }

        console.log('Updating index:', data)
        const { data: updatedIndex, error: updateError } = await supabase
          .from('indexes')
          .update({
            name: data.name,
            description: data.description
          })
          .eq('id', data.id)
          .select()
          .single()

        if (updateError) {
          console.error('Error updating index:', updateError)
          return new Response(
            JSON.stringify({ error: 'Error updating index' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }

        return new Response(
          JSON.stringify({ index: updatedIndex }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

      case 'deleteIndex':
        // Only admin can delete indexes
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: 'Only admin users can delete indexes' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
          )
        }

        console.log('Deleting index:', data.id)
        const { error: deleteError } = await supabase
          .from('indexes')
          .delete()
          .eq('id', data.id)

        if (deleteError) {
          console.error('Error deleting index:', deleteError)
          return new Response(
            JSON.stringify({ error: 'Error deleting index' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

      // ===== Index Update Operations =====
      case 'getIndexUpdates':
        // Both admin and company users can read index updates
        console.log('Getting index updates for index:', data.indexId)
        const { data: updates, error: updatesError } = await supabase
          .from('indexes_update')
          .select('*')
          .eq('index_id', data.indexId)
          .order('reference_month')

        if (updatesError) {
          console.error('Error fetching index updates:', updatesError)
          return new Response(
            JSON.stringify({ error: 'Error fetching index updates' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }

        return new Response(
          JSON.stringify({ updates }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

      case 'createIndexUpdate':
        // Only admin can create index updates
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: 'Only admin users can create index updates' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
          )
        }

        // Validate the reference month
        if (!data.referenceMonth || data.referenceMonth.trim() === "") {
          return new Response(
            JSON.stringify({ error: 'Reference month is required' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        try {
          // Parse the reference month string to a Date object (with day set to 1)
          const [year, month] = data.referenceMonth.split('-').map(Number);
          
          if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
            throw new Error("Invalid date format");
          }

          // Create a valid date object for the first day of the month
          // Using UTC to avoid timezone issues
          const referenceDate = new Date(Date.UTC(year, month - 1, 1));
          
          // Validate that the date is valid before proceeding
          if (isNaN(referenceDate.getTime())) {
            throw new Error("Invalid date created");
          }
          
          console.log('Creating index update:', {
            index_id: data.indexId,
            reference_month: referenceDate.toISOString(),
            monthly_adjustment: data.monthlyAdjustment
          });

          const { data: newUpdate, error: createUpdateError } = await supabase
            .from('indexes_update')
            .insert({
              index_id: data.indexId,
              reference_month: referenceDate.toISOString(),
              monthly_adjustment: data.monthlyAdjustment
            })
            .select()
            .single();

          if (createUpdateError) {
            console.error('Error creating index update:', createUpdateError);
            return new Response(
              JSON.stringify({ error: 'Error creating index update: ' + createUpdateError.message }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
          }

          return new Response(
            JSON.stringify({ update: newUpdate }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
          );
        } catch (error) {
          console.error('Error processing date:', error);
          return new Response(
            JSON.stringify({ error: 'Invalid date format. Please use YYYY-MM format.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

      case 'updateIndexUpdate':
        // Only admin can update index updates
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: 'Only admin users can update index updates' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
          )
        }

        console.log('Updating index update:', data)
        const { data: updatedUpdate, error: updateUpdateError } = await supabase
          .from('indexes_update')
          .update({
            monthly_adjustment: data.monthlyAdjustment
          })
          .eq('id', data.id)
          .select()
          .single()

        if (updateUpdateError) {
          console.error('Error updating index update:', updateUpdateError)
          return new Response(
            JSON.stringify({ error: 'Error updating index update' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }

        return new Response(
          JSON.stringify({ update: updatedUpdate }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

      case 'deleteIndexUpdate':
        // Only admin can delete index updates
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: 'Only admin users can delete index updates' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
          )
        }

        console.log('Deleting index update:', data.id)
        const { error: deleteUpdateError } = await supabase
          .from('indexes_update')
          .delete()
          .eq('id', data.id)

        if (deleteUpdateError) {
          console.error('Error deleting index update:', deleteUpdateError)
          return new Response(
            JSON.stringify({ error: 'Error deleting index update' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

      // ===== Payment Plan Index Operations =====
      case 'getIndexesForSelect':
        // Both admin and company users can read indexes for select dropdowns
        console.log('Getting indexes for select dropdown')
        const { data: indexesForSelect, error: indexesSelectError } = await supabase
          .from('indexes')
          .select('id, name')
          .order('name')

        if (indexesSelectError) {
          console.error('Error fetching indexes for select:', indexesSelectError)
          return new Response(
            JSON.stringify({ error: 'Error fetching indexes for select' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }

        return new Response(
          JSON.stringify({ indexes: indexesForSelect }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

      // ===== Calculation =====
      case 'calculateCompoundAdjustment':
        // Both admin and company users can calculate compound adjustments
        console.log('Calculating compound adjustment:', data)
        const { indexId, startDate, endDate } = data
        
        if (!indexId || !startDate || !endDate) {
          return new Response(
            JSON.stringify({ error: 'Missing required parameters: indexId, startDate, endDate' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        // Format dates to always use first day of month
        const start = new Date(startDate)
        start.setDate(1)
        const end = new Date(endDate)
        end.setDate(1)
        
        // Fetch all relevant monthly adjustments
        const { data: adjustments, error: adjustmentsError } = await supabase
          .from('indexes_update')
          .select('reference_month, monthly_adjustment')
          .eq('index_id', indexId)
          .gte('reference_month', start.toISOString())
          .lte('reference_month', end.toISOString())
          .order('reference_month')

        if (adjustmentsError) {
          console.error('Error fetching adjustments:', adjustmentsError)
          return new Response(
            JSON.stringify({ error: 'Error fetching adjustments' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }

        // Calculate compound adjustment
        let compoundFactor = 1.0
        for (const adjustment of adjustments) {
          // Convert percentage to decimal factor (e.g., 2.5% -> 1.025)
          const factor = 1 + (adjustment.monthly_adjustment / 100)
          compoundFactor *= factor
        }

        // Convert to percentage
        const compoundPercentage = (compoundFactor - 1) * 100

        return new Response(
          JSON.stringify({
            compoundAdjustment: {
              factor: compoundFactor,
              percentage: compoundPercentage,
              appliedMonths: adjustments.length,
              months: adjustments
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
  } catch (error) {
    console.error('Error processing request:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
