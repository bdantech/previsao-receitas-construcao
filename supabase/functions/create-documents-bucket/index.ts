
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

// This function creates the necessary documents storage bucket if it doesn't exist
serve(async (req) => {
  try {
    // Get admin Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ 
        error: 'Missing environment variables' 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Create the documents bucket if it doesn't exist
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    
    if (bucketsError) {
      return new Response(JSON.stringify({ 
        error: 'Failed to list buckets',
        details: bucketsError.message 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Check if documents bucket exists
    const documentsBucket = buckets.find(bucket => bucket.name === 'documents')
    
    if (!documentsBucket) {
      // Create the bucket
      const { error: createError } = await supabase.storage.createBucket('documents', {
        public: false,
        fileSizeLimit: 50 * 1024 * 1024, // 50 MB file size limit
      })
      
      if (createError) {
        return new Response(JSON.stringify({ 
          error: 'Failed to create documents bucket',
          details: createError.message 
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Documents bucket created successfully'
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Documents bucket already exists'
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (err) {
    return new Response(JSON.stringify({ 
      error: 'Unexpected error',
      details: err.message
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
