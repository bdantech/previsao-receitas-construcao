import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Document {
  id: string;
  document_type_id: string;
  resource_type: string;
  resource_id: string;
  status: string;
  file_path: string;
  file_name: string;
  submitted_by: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
}

export const useCompanyDocuments = () => {
  const { getAuthHeader } = useAuth();

  const uploadFile = async (file: File, resourceType: string, resourceId: string) => {
    try {
      const headers = getAuthHeader();
      
      // Convert file to base64
      const base64File = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
      });

      const { data, error } = await supabase.functions.invoke('document-management', {
        body: {
          action: 'uploadFile',
          file: base64File,
          fileName: file.name,
          resourceType,
          resourceId
        },
        headers: headers
      });

      if (error) {
        console.error('Error uploading file:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  const getDocuments = async (resourceType: string, resourceId: string): Promise<Document[]> => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('resource_type', resourceType)
        .eq('resource_id', resourceId);

      if (error) {
        console.error('Error fetching documents:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error:', error);
      return [];
    }
  };

  const updateDocumentStatus = async (documentId: string, status: string) => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .update({ status })
        .eq('id', documentId)
        .select();

      if (error) {
        console.error('Error updating document status:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error updating document status:', error);
      throw error;
    }
  };

  return {
    getDocuments,
    updateDocumentStatus,
    uploadFile,
  };
};
