
// This file is automatically generated. Do not edit it directly.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://hshfqxjrilqzjpkcotgz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzaGZxeGpyaWxxempwa2NvdGd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE1MzA4NDcsImV4cCI6MjA1NzEwNjg0N30.8GG-VHaE5AsSioozj1wKH7NI0Az-PqWcOLmH5UMvsJY";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Helper to get auth headers for function calls
const getAuthHeaders = async () => {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  
  if (session?.access_token) {
    return {
      Authorization: `Bearer ${session.access_token}`
    };
  }
  
  return {};
};

// Document management API utilities
export const documentManagementApi = {
  // Document Types
  getDocumentTypes: async () => {
    const headers = await getAuthHeaders();
    const { data } = await supabase.functions.invoke('document-management', {
      headers,
      body: { 
        action: 'getDocumentTypes'
      }
    });
    return data?.documentTypes || [];
  },
  
  createDocumentType: async (documentType: { name: string, resource: string, description?: string, required?: boolean }) => {
    const headers = await getAuthHeaders();
    const { data } = await supabase.functions.invoke('document-management', {
      method: 'POST',
      headers,
      body: { 
        action: 'createDocumentType',
        documentType
      }
    });
    return data;
  },
  
  // Documents
  getDocuments: async (filters?: { resourceType?: string, resourceId?: string, status?: string }) => {
    const headers = await getAuthHeaders();
    const { data } = await supabase.functions.invoke('document-management', {
      headers,
      body: { 
        action: 'getDocuments',
        filters
      }
    });
    return data?.documents || [];
  },
  
  submitDocument: async (document: {
    documentTypeId: string,
    resourceType: string,
    resourceId: string,
    filePath: string,
    fileName: string,
    fileSize?: number,
    mimeType?: string
  }) => {
    const headers = await getAuthHeaders();
    const { data } = await supabase.functions.invoke('document-management', {
      method: 'POST',
      headers,
      body: { 
        action: 'submitDocument',
        document
      }
    });
    return data;
  },
  
  updateDocumentStatus: async (update: { id: string, status: string, reviewNotes?: string }) => {
    const headers = await getAuthHeaders();
    const { data } = await supabase.functions.invoke('document-management', {
      method: 'PUT',
      headers,
      body: { 
        action: 'updateDocumentStatus',
        update
      }
    });
    return data;
  }
};

// Project management API utilities
export const projectManagementApi = {
  // Get user's company
  getUserCompany: async () => {
    const headers = await getAuthHeaders();
    const { data } = await supabase.functions.invoke('project-management', {
      headers,
      body: {
        method: 'GET',
        endpoint: 'user-company'
      }
    });
    return data?.companyId;
  },
  
  // Get projects
  getProjects: async (filters?: { name?: string, status?: string }) => {
    const headers = await getAuthHeaders();
    const { data } = await supabase.functions.invoke('project-management', {
      headers,
      body: {
        method: 'GET',
        endpoint: 'projects',
        ...filters
      }
    });
    return data?.projects || [];
  },
  
  // Create project
  createProject: async (project: {
    name: string,
    cnpj: string,
    company_id: string,
    initial_date: string,
    end_date?: string | null
  }) => {
    const headers = await getAuthHeaders();
    const { data } = await supabase.functions.invoke('project-management', {
      method: 'POST',
      headers,
      body: {
        method: 'POST',
        endpoint: 'projects',
        ...project
      }
    });
    return data?.project;
  },
  
  // Get single project
  getProject: async (id: string) => {
    const headers = await getAuthHeaders();
    const { data } = await supabase.functions.invoke('project-management', {
      headers,
      body: {
        method: 'GET',
        endpoint: `projects/${id}`
      }
    });
    return data?.project;
  },
  
  // Update project
  updateProject: async (id: string, updates: {
    name?: string,
    status?: 'active' | 'inactive',
    end_date?: string | null
  }) => {
    const headers = await getAuthHeaders();
    const { data } = await supabase.functions.invoke('project-management', {
      method: 'PUT',
      headers,
      body: {
        method: 'PUT',
        endpoint: id,
        ...updates
      }
    });
    return data?.project;
  }
};
