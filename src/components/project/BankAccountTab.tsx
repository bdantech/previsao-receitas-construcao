import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Banknote, AlertCircle, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

interface BankAccount {
  id: string;
  account_name: string;
  account_number: string;
  balance: number;
  bank_account_url: string | null;
  company_id: string;
  project_id: string;
}

interface BankAccountTabProps {
  projectId: string;
}

export function BankAccountTab({ projectId }: BankAccountTabProps) {
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    async function fetchBankAccount() {
      if (!session?.access_token) {
        setError('Não autorizado. Por favor, faça login novamente.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase.functions.invoke('read-bank-account', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        });

        if (error) {
          console.error('Error fetching bank account:', error);
          throw error;
        }

        if (!data?.bankAccounts) {
          throw new Error('Dados inválidos recebidos do servidor');
        }

        // Filter bank accounts to find the one for this project
        const projectBankAccount = data.bankAccounts.find(
          (account: BankAccount) => account.project_id === projectId
        );

        setBankAccount(projectBankAccount || null);
      } catch (err) {
        console.error('Error fetching bank account:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar informações da conta bancária');
      } finally {
        setLoading(false);
      }
    }

    fetchBankAccount();
  }, [projectId, session]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erro</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!bankAccount) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Nenhuma conta bancária encontrada</AlertTitle>
        <AlertDescription>
          Não há contas bancárias associadas a este projeto.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Banknote className="h-5 w-5" />
          Conta Bancária
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Nome da Conta</p>
            <p className="text-lg font-semibold">{bankAccount.account_name}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Número da Conta</p>
            <p className="text-lg font-semibold">{bankAccount.account_number}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Saldo</p>
            <p className="text-lg font-semibold">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(bankAccount.balance)}
            </p>
          </div>
          {bankAccount.bank_account_url && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Acesso ao Banco</p>
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => window.open(bankAccount.bank_account_url, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="h-4 w-4" />
                Acessar Conta
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 