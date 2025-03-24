
import React, { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface DocumentReviewDialogProps {
  documentId: string;
  documentName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  actionType: "approve" | "reject" | "revision";
}

export const DocumentReviewDialog: React.FC<DocumentReviewDialogProps> = ({
  documentId,
  documentName,
  isOpen,
  onClose,
  onSuccess,
  actionType
}) => {
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { getAuthHeader } = useAuth();

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      let newStatus: "approved" | "needs_revision" | "rejected";
      switch (actionType) {
        case "approve":
          newStatus = "approved";
          break;
        case "reject":
          newStatus = "rejected";
          break;
        case "revision":
          newStatus = "needs_revision";
          break;
      }

      const { data, error } = await supabase.functions.invoke('document-management', {
        body: {
          action: 'updateDocumentStatus',
          documentId,
          status: newStatus,
          reviewNotes: notes || null
        },
        headers: await getAuthHeader()
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Status do documento atualizado com sucesso.",
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error updating document status:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do documento.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDialogTitle = () => {
    switch (actionType) {
      case "approve": return "Aprovar Documento";
      case "reject": return "Reprovar Documento";
      case "revision": return "Solicitar Revisão";
    }
  };

  const getDialogDescription = () => {
    switch (actionType) {
      case "approve": return "Confirme a aprovação do documento.";
      case "reject": return "Informe o motivo da reprovação do documento.";
      case "revision": return "Informe o que precisa ser revisado no documento.";
    }
  };

  const getButtonText = () => {
    switch (actionType) {
      case "approve": return "Aprovar";
      case "reject": return "Reprovar";
      case "revision": return "Solicitar Revisão";
    }
  };

  const notesRequired = actionType !== "approve";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          <DialogDescription>{getDialogDescription()}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="mb-4">
            <p className="text-sm font-medium mb-1">Documento:</p>
            <p className="text-sm">{documentName}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">
              {notesRequired ? "Observações (obrigatório)" : "Observações (opcional)"}
            </Label>
            <Textarea 
              id="notes"
              placeholder={notesRequired ? "Informe o motivo..." : "Observações adicionais..."}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting || (notesRequired && !notes.trim())}
            variant={actionType === "approve" ? "success" : actionType === "reject" ? "destructive" : "warning"}
          >
            {isSubmitting ? "Processando..." : getButtonText()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
