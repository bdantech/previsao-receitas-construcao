import { CreateBankAccountDialog } from "@/components/bank-accounts/CreateBankAccountDialog";
import { EditBankAccountDialog } from "@/components/bank-accounts/EditBankAccountDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { Loader2, Plus } from "lucide-react";
import React, { useEffect, useState } from "react";

type BankAccount = {
  id: string;
  account_name: string;
  account_number: string;
  balance: number;
  bank_project_id: string | null;
  private_key: string | null;
  public_key: string | null;
  company_id: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  companies: {
    id: string;
    name: string;
  };
  projects: {
    id: string;
    name: string;
  };
};

const AdminBankAccountsPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  const { toast } = useToast();
  const { getAuthHeader } = useAuth();

  useEffect(() => {
    fetchBankAccounts();
  }, []);

  const fetchBankAccounts = async () => {
    setIsLoading(true);
    try {
      console.log("Fetching bank accounts...");
      const response = await supabase.functions.invoke("admin-bank-accounts", {
        method: 'POST',
        body: JSON.stringify({
          action: "list"
        }),
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
      });

      console.log("Full response:", response);
      console.log("Response data:", response.data);
      console.log("Response error:", response.error);

      if (response.error) {
        console.error("Error fetching bank accounts:", response.error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível carregar as contas bancárias.",
        });
        return;
      }

      // Check the structure of response.data
      if (!response.data) {
        console.error("No data in response");
        return;
      }

      const accounts = Array.isArray(response.data) ? response.data : response.data.data || [];
      console.log("Processed bank accounts data:", accounts);
      setBankAccounts(accounts);
    } catch (error) {
      console.error("Error:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao carregar contas bancárias.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditAccount = (account: BankAccount) => {
    setSelectedAccount(account);
    setEditDialogOpen(true);
  };

  const handleDeleteAccount = (id: string) => {
    setAccountToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteAccount = async () => {
    if (!accountToDelete) return;

    try {
      const { error } = await supabase.functions.invoke("admin-bank-accounts", {
        method: 'POST',
        body: JSON.stringify({
          action: "delete",
          id: accountToDelete
        }),
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
      });

      if (error) {
        console.error("Error deleting bank account:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível excluir a conta bancária.",
        });
        return;
      }

      toast({
        title: "Conta bancária excluída com sucesso",
        description: "A conta bancária foi excluída do sistema.",
      });
      
      fetchBankAccounts();
    } catch (error) {
      console.error("Error:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao excluir conta bancária.",
      });
    } finally {
      setDeleteDialogOpen(false);
      setAccountToDelete(null);
    }
  };

  return (
    <>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Contas Bancárias</h1>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Conta Bancária
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Nome da Conta</TableHead>
                <TableHead>Número da Conta</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>ID do Projeto (Banco)</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4">
                    <div className="flex justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : bankAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4">
                    Nenhuma conta bancária encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                bankAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>{account.companies.name}</TableCell>
                    <TableCell>{account.projects.name}</TableCell>
                    <TableCell>{account.account_name}</TableCell>
                    <TableCell>{account.account_number}</TableCell>
                    <TableCell>{formatCurrency(account.balance)}</TableCell>
                    <TableCell>{account.bank_project_id || 'N/A'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditAccount(account)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteAccount(account.id)}
                          className="text-red-500 hover:text-red-600"
                        >
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <CreateBankAccountDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          onSuccess={fetchBankAccounts}
        />

        <EditBankAccountDialog
          account={selectedAccount}
          open={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false);
            setSelectedAccount(null);
          }}
          onSuccess={fetchBankAccounts}
        />

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Conta Bancária</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta conta bancária? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteAccount}
                className="bg-red-500 hover:bg-red-600"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};

export default AdminBankAccountsPage; 