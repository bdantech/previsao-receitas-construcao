import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
// This function creates a documents bucket with RLS policies that allow all authenticated users to upload documents
// Normally this would be done via migrations, but since we need to create buckets we use a function
serve(async ()=>{
  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing required environment variables for Supabase");
    }
    // Initialize Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Check if bucket already exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      throw new Error(`Error listing buckets: ${listError.message}`);
    }
    const documentsBucketExists = buckets?.some((bucket)=>bucket.name === 'documents');
    if (!documentsBucketExists) {
      // Create documents bucket
      const { error: createError } = await supabase.storage.createBucket('documents', {
        public: false,
        allowedMimeTypes: [
          'application/pdf',
          'image/png',
          'image/jpeg',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ],
        fileSizeLimit: 5242880 // 5MB
      });
      if (createError) {
        throw new Error(`Error creating documents bucket: ${createError.message}`);
      }
      console.log("Documents bucket created successfully");
    } else {
      console.log("Documents bucket already exists");
    }
    // Update RLS policies for the documents bucket
    // First, make sure bucket is not public
    const { error: updateError } = await supabase.storage.updateBucket('documents', {
      public: false
    });
    if (updateError) {
      throw new Error(`Error updating documents bucket: ${updateError.message}`);
    }
    // Create policy to allow authenticated users to upload files
    await supabase.rpc('create_storage_policy', {
      bucket_name: 'documents',
      policy_name: 'Allow authenticated users to upload files',
      definition: 'INSERT',
      policy_expression: 'auth.role() = \'authenticated\''
    });
    // Create policy to allow authenticated users to download files
    await supabase.rpc('create_storage_policy', {
      bucket_name: 'documents',
      policy_name: 'Allow authenticated users to download files',
      definition: 'SELECT',
      policy_expression: 'auth.role() = \'authenticated\''
    });
    // Create policy to allow authenticated users to update files
    await supabase.rpc('create_storage_policy', {
      bucket_name: 'documents',
      policy_name: 'Allow authenticated users to update files',
      definition: 'UPDATE',
      policy_expression: 'auth.role() = \'authenticated\''
    });
    return new Response(JSON.stringify({
      success: true,
      message: "Documents bucket setup completed successfully"
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("Error setting up documents bucket:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: {
        "Content-Type": "application/json"
      },
      status: 500
    });
  }
});
