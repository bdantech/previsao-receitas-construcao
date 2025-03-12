import { createClient } from '@supabase/supabase-js';
import { Database } from '@/integrations/supabase/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined');
}

if (!supabaseKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Auth API
export const authApi = {
  async signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      throw error;
    }

    return data;
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  },

  async recoverPassword(email: string) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });

    if (error) {
      throw error;
    }

    return data;
  },

  async updatePassword(password: string) {
    const { data, error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      throw error;
    }

    return data;
  },
};

// Companies API
export const companiesApi = {
  async getCompanies() {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  },

  async getCompany(id: string) {
    const { data, error } = await supabase.from('companies').select('*').eq('id', id).single();

    if (error) {
      throw error;
    }

    return data;
  },

  async createCompany(name: string) {
    const { data, error } = await supabase.from('companies').insert([{ name }]).select().single();

    if (error) {
      throw error;
    }

    return data;
  },

  async updateCompany(id: string, name: string) {
    const { data, error } = await supabase.from('companies').update({ name }).eq('id', id).select().single();

    if (error) {
      throw error;
    }

    return data;
  },

  async deleteCompany(id: string) {
    const { data, error } = await supabase.from('companies').delete().eq('id', id).select().single();

    if (error) {
      throw error;
    }

    return data;
  },
};

// Projects API
export const projectsApi = {
  async getProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('*, company:company_id(*)')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  },

  async getProject(id: string) {
    const { data, error } = await supabase.from('projects').select('*, company:company_id(*)').eq('id', id).single();

    if (error) {
      throw error;
    }

    return data;
  },

  async createProject(name: string, company_id: string) {
    const { data, error } = await supabase.from('projects').insert([{ name, company_id }]).select().single();

    if (error) {
      throw error;
    }

    return data;
  },

  async updateProject(id: string, name: string, company_id: string) {
    const { data, error } = await supabase.from('projects').update({ name, company_id }).eq('id', id).select().single();

    if (error) {
      throw error;
    }

    return data;
  },

  async deleteProject(id: string) {
    const { data, error } = await supabase.from('projects').delete().eq('id', id).select().single();

    if (error) {
      throw error;
    }

    return data;
  },
};

// Project Buyers API
export const projectBuyersApi = {
  async createBuyer(projectId, buyerData) {
    const { data, error } = await supabase.functions.invoke('project-buyers', {
      body: {
        action: 'create',
        projectId,
        buyerData
      }
    });
    
    if (error) throw new Error(error.message);
    return data.buyer;
  },
  
  async getBuyers(projectId) {
    const { data, error } = await supabase.functions.invoke('project-buyers', {
      body: {
        action: 'list',
        projectId
      }
    });
    
    if (error) throw new Error(error.message);
    return data.buyers;
  },
  
  async getBuyer(buyerId) {
    const { data, error } = await supabase.functions.invoke('project-buyers', {
      body: {
        action: 'get',
        buyerId
      }
    });
    
    if (error) throw new Error(error.message);
    return data.buyer;
  },
  
  async updateBuyer(buyerId, buyerData) {
    const { data, error } = await supabase.functions.invoke('project-buyers', {
      body: {
        action: 'update',
        buyerId,
        buyerData
      }
    });
    
    if (error) throw new Error(error.message);
    return data.buyer;
  },
  
  admin: {
    async getAllBuyers() {
      const { data, error } = await supabase.functions.invoke('admin-project-buyers', {
        body: {
          action: 'list'
        }
      });
      
      if (error) throw new Error(error.message);
      return data.buyers;
    },
    
    async getBuyer(buyerId) {
      const { data, error } = await supabase.functions.invoke('admin-project-buyers', {
        body: {
          action: 'get',
          buyerId
        }
      });
      
      if (error) throw new Error(error.message);
      return data.buyer;
    },
    
    async updateBuyer(buyerId, buyerData) {
      const { data, error } = await supabase.functions.invoke('admin-project-buyers', {
        body: {
          action: 'update',
          buyerId,
          buyerData
        }
      });
      
      if (error) throw new Error(error.message);
      return data.buyer;
    }
  }
};

// Document Management API
export const documentManagementApi = {
  async getCompanyDocuments(companyId: string) {
    const { data, error } = await supabase.functions.invoke('document-management', {
      body: {
        action: 'getCompanyDocuments',
        companyId
      }
    });
    
    if (error) throw new Error(error.message);
    return data.documents;
  },
  
  async uploadDocument(documentData: any, file: File) {
    const { data, error } = await supabase.functions.invoke('document-management', {
      body: {
        action: 'uploadDocument',
        documentData
      }
    });
    
    if (error) throw new Error(error.message);
    return data.document;
  },
  
  async updateDocumentStatus(documentId: string, status: string, reviewNotes?: string) {
    const { data, error } = await supabase.functions.invoke('document-management', {
      body: {
        action: 'updateDocumentStatus',
        documentId,
        status,
        reviewNotes
      }
    });
    
    if (error) throw new Error(error.message);
    return data.document;
  }
};

// Receivables API
export const receivablesApi = {
  async getProjectReceivables(projectId: string) {
    const { data, error } = await supabase.functions.invoke('project-receivables', {
      body: {
        action: 'list',
        projectId
      }
    });
    
    if (error) throw new Error(error.message);
    return data.receivables;
  },
  
  async createReceivable(receivableData: any) {
    const { data, error } = await supabase.functions.invoke('project-receivables', {
      body: {
        action: 'create',
        receivableData
      }
    });
    
    if (error) throw new Error(error.message);
    return data.receivable;
  },
  
  async updateReceivable(receivableId: string, receivableData: any) {
    const { data, error } = await supabase.functions.invoke('project-receivables', {
      body: {
        action: 'update',
        receivableId,
        receivableData
      }
    });
    
    if (error) throw new Error(error.message);
    return data.receivable;
  },
  
  admin: {
    async getAllReceivables() {
      const { data, error } = await supabase.functions.invoke('admin-receivables', {
        body: {
          action: 'list'
        }
      });
      
      if (error) throw new Error(error.message);
      return data.receivables;
    },
    
    async getReceivable(receivableId: string) {
      const { data, error } = await supabase.functions.invoke('admin-receivables', {
        body: {
          action: 'get',
          receivableId
        }
      });
      
      if (error) throw new Error(error.message);
      return data.receivable;
    },
    
    async updateReceivableStatus(receivableId: string, status: string) {
      const { data, error } = await supabase.functions.invoke('admin-receivables', {
        body: {
          action: 'updateStatus',
          receivableId,
          status
        }
      });
      
      if (error) throw new Error(error.message);
      return data.receivable;
    }
  }
};
