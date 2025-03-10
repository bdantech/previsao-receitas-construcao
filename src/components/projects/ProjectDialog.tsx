
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated: (project: any) => void;
}

export const ProjectDialog = ({ open, onOpenChange, onProjectCreated }: ProjectDialogProps) => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [initialDate, setInitialDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [fetchingCompany, setFetchingCompany] = useState(false);
  
  // Fetch the user's company ID when the dialog opens
  useEffect(() => {
    const fetchUserCompany = async () => {
      if (!session?.user) return;
      
      try {
        setFetchingCompany(true);
        
        // Use the functions API instead of direct database access
        const { data, error } = await supabase.functions.invoke('project-management', {
          body: {
            method: 'GET',
            endpoint: 'user-company'
          }
        });
        
        if (error) {
          console.error('Error fetching user company:', error);
          toast({
            title: "Erro ao carregar empresa",
            description: "Não foi possível carregar os dados da sua empresa.",
            variant: "destructive"
          });
          return;
        }
          
        if (data && data.companyId) {
          console.log('Company fetched successfully:', data.companyId);
          setCompanyId(data.companyId);
        } else {
          console.error('No company ID found for user');
          toast({
            title: "Empresa não encontrada",
            description: "Você precisa estar associado a uma empresa para criar projetos.",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Error fetching user company:', error);
      } finally {
        setFetchingCompany(false);
      }
    };
    
    if (open) {
      fetchUserCompany();
    }
  }, [open, session, toast]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Debug output to check the form values
    console.log("Form values:", {
      name,
      cnpj,
      initialDate,
      companyId
    });
    
    if (!name || !cnpj || !initialDate || !companyId) {
      // Log which fields are missing
      console.log("Missing fields:", {
        name: !name,
        cnpj: !cnpj,
        initialDate: !initialDate,
        companyId: !companyId
      });
      
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      const response = await supabase.functions.invoke('project-management', {
        body: {
          method: 'POST',
          endpoint: 'projects',
          name,
          cnpj,
          company_id: companyId,
          initial_date: initialDate,
          end_date: endDate || null
        }
      });
      
      if (response.error) {
        console.error("Project creation error:", response.error);
        toast({
          title: "Erro ao criar projeto",
          description: response.error.message || "Ocorreu um erro ao criar o projeto.",
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "Projeto criado",
        description: "Projeto criado com sucesso!",
      });
      
      // Reset form
      setName("");
      setCnpj("");
      setInitialDate("");
      setEndDate("");
      
      // Pass the new project to the parent component
      if (response.data && response.data.project) {
        onProjectCreated(response.data.project);
      }
    } catch (error: any) {
      console.error("Project creation exception:", error);
      toast({
        title: "Erro ao criar projeto",
        description: error.message || "Ocorreu um erro ao criar o projeto.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Criar Novo Projeto</DialogTitle>
          <DialogDescription>
            Preencha os detalhes do projeto para criar um novo projeto para sua empresa.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Projeto *</Label>
              <Input 
                id="name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Digite o nome do projeto"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ *</Label>
              <Input 
                id="cnpj" 
                value={cnpj} 
                onChange={(e) => setCnpj(e.target.value)} 
                placeholder="Digite o CNPJ do projeto"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="initialDate">Data de Início *</Label>
              <Input 
                id="initialDate" 
                type="date" 
                value={initialDate} 
                onChange={(e) => setInitialDate(e.target.value)} 
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endDate">Data de Encerramento</Label>
              <Input 
                id="endDate" 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
              />
            </div>
          </div>
          
          <div className="flex justify-end pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="mr-2"
              disabled={isLoading || fetchingCompany}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || fetchingCompany}>
              {isLoading ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : fetchingCompany ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  Carregando empresa...
                </>
              ) : (
                'Criar Projeto'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
