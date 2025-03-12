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
  // Get the current user session
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
  getDocuments: async (filters?: { resourceType?: string, resourceId?: string, status?: string, userId?: string }) => {
    const headers = await getAuthHeaders();
    const { data, error } = await supabase.functions.invoke('document-management', {
      headers,
      body: { 
        action: 'getDocuments',
        filters
      }
    });
    
    if (error) {
      console.error('Error in getDocuments:', error);
      throw error;
    }
    
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
  },
  
  // Get user documents - new method that doesn't rely on company ID
  getUserDocuments: async () => {
    try {
      console.log('Getting fresh session for user documents...');
      // Get the current session instead of refreshing it
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No valid session available');
        throw new Error('No valid session');
      }
      
      console.log('Using session for user documents:', {
        userId: session.user?.id,
        expiresAt: session.expires_at
      });
      
      // Call Edge function with proper headers
      const { data, error } = await supabase.functions.invoke('document-management', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: { 
          action: 'getDocuments'
          // No filters - will default to current user's documents
        }
      });

      if (error) {
        console.error('Error fetching user documents:', error);
        throw error;
      }

      if (!data?.documents) {
        console.error('No documents data in response:', data);
        throw new Error('Invalid response format');
      }

      console.log('User documents response:', data);
      
      // Process documents and ensure they have consistent structure
      return data.documents.map(doc => ({
        ...doc,
        file_path: doc.file_path || '',
        file_name: doc.file_name || `Document ${doc.id}`,
        document_type: {
          id: doc.document_type?.id || '',
          name: doc.document_type?.name || 'Unknown Document Type',
          description: doc.document_type?.description || '',
          required: doc.document_type?.required || false
        },
        status: doc.status || 'not_sent'
      }));
    } catch (error) {
      console.error('Exception in getUserDocuments:', error);
      throw error; // Let the component handle the error
    }
  },
  
  // Keep the original method for backward compatibility
  getCompanyDocuments: async (companyId: string) => {
    try {
      console.log('Getting fresh session...');
      // Force session refresh
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('Session refresh error:', refreshError);
        throw new Error('Session refresh failed: ' + refreshError.message);
      }
      
      if (!session) {
        console.error('No session after refresh');
        throw new Error('No valid session');
      }
      
      console.log('Using session:', {
        userId: session.user?.id,
        expiresAt: session.expires_at
      });
      
      // Call Edge function with proper headers
      const { data, error } = await supabase.functions.invoke('document-management', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: { 
          action: 'getDocuments',
          filters: {
            resourceType: 'company',
            resourceId: companyId
          }
        }
      });

      if (error) {
        console.error('Error fetching company documents:', error);
        throw error;
      }

      if (!data?.documents) {
        console.error('No documents data in response:', data);
        throw new Error('Invalid response format');
      }

      console.log('Documents response:', data);
      
      // Process documents and ensure they have consistent structure
      return data.documents.map(doc => ({
        ...doc,
        file_path: doc.file_path || '',
        file_name: doc.file_name || `Document ${doc.id}`,
        document_type: {
          id: doc.document_type?.id || '',
          name: doc.document_type?.name || 'Unknown Document Type',
          description: doc.document_type?.description || '',
          required: doc.document_type?.required || false
        },
        status: doc.status || 'not_sent'
      }));
    } catch (error) {
      console.error('Exception in getCompanyDocuments:', error);
      throw error; // Let the component handle the error
    }
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
  },
  
  // Admin-specific: Get all projects for a company
  getCompanyProjects: async (companyId: string) => {
    try {
      const headers = await getAuthHeaders();
      const { data, error } = await supabase.functions.invoke('admin-project-management', {
        method: 'POST',
        headers,
        body: {
          companyId
        }
      });
      
      if (error) {
        console.error('Error fetching company projects:', error);
        throw error;
      }
      
      return data?.projects || [];
    } catch (error) {
      console.error('Exception in getCompanyProjects:', error);
      throw error;
    }
  }
};

// Project buyers API utilities
export const projectBuyersApi = {
  // For regular users (company-specific)
  getBuyers: async (projectId?: string) => {
    try {
      const headers = await getAuthHeaders();
      const { data, error } = await supabase.functions.invoke('project-buyers', {
        headers,
        body: { 
          action: 'list',
          projectId
        }
      });
      
      if (error) {
        console.error('Error fetching project buyers:', error);
        throw error;
      }
      
      return data?.buyers || [];
    } catch (error) {
      console.error('Exception in getBuyers:', error);
      throw error;
    }
  },
  
  getBuyer: async (buyerId: string) => {
    const headers = await getAuthHeaders();
    const { data, error } = await supabase.functions.invoke('project-buyers', {
      headers,
      body: { 
        action: 'get',
        buyerId
      }
    });
    
    if (error) {
      console.error('Error fetching project buyer:', error);
      throw error;
    }
    
    return data?.buyer;
  },
  
  createBuyer: async (projectId: string, buyerData: {
    full_name: string,
    cpf: string,
    contract_file_path?: string,
    contract_file_name?: string
  }) => {
    const headers = await getAuthHeaders();
    const { data, error } = await supabase.functions.invoke('project-buyers', {
      method: 'POST',
      headers,
      body: { 
        action: 'create',
        projectId,
        buyerData
      }
    });
    
    if (error) {
      console.error('Error creating project buyer:', error);
      throw error;
    }
    
    return data?.buyer;
  },
  
  updateBuyer: async (buyerId: string, buyerData: {
    full_name?: string,
    cpf?: string,
    contract_file_path?: string,
    contract_file_name?: string,
    contract_status?: 'aprovado' | 'reprovado' | 'a_enviar',
    credit_analysis_status?: 'aprovado' | 'reprovado' | 'a_analisar'
  }) => {
    const headers = await getAuthHeaders();
    const { data, error } = await supabase.functions.invoke('project-buyers', {
      method: 'PUT',
      headers,
      body: { 
        action: 'update',
        buyerId,
        buyerData
      }
    });
    
    if (error) {
      console.error('Error updating project buyer:', error);
      throw error;
    }
    
    return data?.buyer;
  },
  
  // Admin-specific methods
  admin: {
    getAllBuyers: async (filters?: {
      companyId?: string,
      projectId?: string,
      buyerStatus?: string,
      contractStatus?: string,
      creditAnalysisStatus?: string,
      fullName?: string,
      cpf?: string
    }) => {
      try {
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          throw new Error('Failed to get session');
        }
        
        if (!session) {
          throw new Error('No active session');
        }

        // Ensure we have a valid access token
        if (!session.access_token) {
          throw new Error('No access token available');
        }

        console.log('Using session for admin buyers:', {
          userId: session.user?.id,
          expiresAt: session.expires_at,
          hasAccessToken: !!session.access_token
        });
        
        const { data, error } = await supabase.functions.invoke('admin-project-buyers', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: { 
            action: 'list',
            filters
          }
        });
        
        if (error) {
          console.error('Error fetching admin buyers:', error);
          throw error;
        }
        
        if (!data?.buyers) {
          console.error('Invalid response format:', data);
          throw new Error('Invalid response format');
        }
        
        console.log('Admin buyers response:', data);
        return data.buyers;
      } catch (error) {
        console.error('Exception in getAllBuyers:', error);
        throw error;
      }
    },
    
    getBuyer: async (buyerId: string) => {
      const headers = await getAuthHeaders();
      const { data, error } = await supabase.functions.invoke('admin-project-buyers', {
        headers,
        body: { 
          action: 'get',
          buyerId
        }
      });
      
      if (error) {
        console.error('Error fetching project buyer details:', error);
        throw error;
      }
      
      return data?.buyer;
    },
    
    updateBuyer: async (buyerId: string, buyerData: {
      full_name?: string,
      cpf?: string,
      contract_file_path?: string,
      contract_file_name?: string,
      contract_status?: 'aprovado' | 'reprovado' | 'a_enviar',
      credit_analysis_status?: 'aprovado' | 'reprovado' | 'a_analisar'
    }) => {
      const headers = await getAuthHeaders();
      const { data, error } = await supabase.functions.invoke('admin-project-buyers', {
        method: 'PUT',
        headers,
        body: { 
          action: 'update',
          buyerId,
          buyerData
        }
      });
      
      if (error) {
        console.error('Error updating project buyer:', error);
        throw error;
      }
      
      return data?.buyer;
    }
  }
};

// Receivables API utilities
export const receivablesApi = {
  getReceivables: async ({ projectId, status, buyerCpf }: { projectId?: string, status?: string, buyerCpf?: string } = {}) => {
    try {
      console.log('Getting session for receivables..aaaaaa.');
      const headers = await getAuthHeaders();
      console.log('headers',headers);
      
      //if (!session) {
      //  console.error('No active session found');
      //  throw new Error('Authentication required');
      //}
      
      //console.log('Using session for receivables:', {
      //  userId: session.user?.id,
      //  expiresAt: session.expires_at
      //});

      const { data, error } = await supabase.functions.invoke('project-receivables', {
        headers,
        body: {
          method: 'GET',
          endpoint: 'receivables',
          projectId,
          status,
          buyerCpf
        }
      });

      if (error) {
        console.error('Error fetching receivables:', error);
        throw error;
      }

      return data?.receivables || [];
    } catch (error) {
      console.error('Exception in getReceivables:', error);
      throw error;
    }
  },
  
  createReceivable: async (receivable: {
    projectId: string,
    buyerCpf: string,
    amount: number,
    dueDate: string,
    description?: string
  }) => {
    try {
      console.log('Getting session for creating receivable...');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No active session found');
        throw new Error('Authentication required');
      }
      
      console.log('Using session for creating receivable:', {
        userId: session.user?.id,
        expiresAt: session.expires_at
      });

      const { data, error } = await supabase.functions.invoke('project-receivables', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          method: 'POST',
          endpoint: 'receivables',
          ...receivable
        }
      });

      if (error) {
        console.error('Error creating receivable:', error);
        throw error;
      }

      return data?.receivable;
    } catch (error) {
      console.error('Exception in createReceivable:', error);
      throw error;
    }
  },
  
  getReceivable: async (id: string) => {
    try {
      const headers = await getAuthHeaders();
      const { data, error } = await supabase.functions.invoke('project-receivables', {
        headers,
        body: { 
          method: 'GET',
          endpoint: `receivables/${id}`
        }
      });
      
      if (error) {
        console.error('Error fetching receivable details:', error);
        throw error;
      }
      
      return data?.receivable;
    } catch (error) {
      console.error('Exception in getReceivable:', error);
      throw error;
    }
  },
  
  updateReceivable: async (id: string, updates: {
    status?: string,
    description?: string
  }) => {
    try {
      const headers = await getAuthHeaders();
      const { data, error } = await supabase.functions.invoke('project-receivables', {
        method: 'PUT',
        headers,
        body: { 
          method: 'PUT',
          endpoint: `receivables/${id}`,
          ...updates
        }
      });
      
      if (error) {
        console.error('Error updating receivable:', error);
        throw error;
      }
      
      return data?.receivable;
    } catch (error) {
      console.error('Exception in updateReceivable:', error);
      throw error;
    }
  },
  
  // Admin-specific methods
  admin: {
    getAllReceivables: async (filters?: {
      companyId?: string,
      projectId?: string,
      status?: string,
      buyerCpf?: string,
      minAmount?: number,
      maxAmount?: number,
      fromDate?: string,
      toDate?: string
    }) => {
      try {
        const headers = await getAuthHeaders();
        const { data, error } = await supabase.functions.invoke('admin-receivables', {
          headers,
          body: { 
            method: 'GET',
            filters
          }
        });
        
        if (error) {
          console.error('Error fetching admin receivables:', error);
          throw error;
        }
        
        return data?.receivables || [];
      } catch (error) {
        console.error('Exception in getAllReceivables:', error);
        throw error;
      }
    }
  }
};
