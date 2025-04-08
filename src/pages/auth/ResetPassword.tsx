import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Lock, ArrowLeft } from 'lucide-react';

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const setupAuth = async () => {
      try {
        // Check for error parameters
        const errorCode = searchParams.get('error_code');
        const errorDescription = searchParams.get('error_description');

        if (errorCode) {
          console.error('Error in URL:', { errorCode, errorDescription });
          const message = errorDescription?.replace(/\+/g, ' ') || 'Link de recuperação inválido ou expirado';
          setError(message);
          return;
        }

        // Get the recovery token from the URL
        const token = searchParams.get('token');
        const type = searchParams.get('type');

        if (!token || type !== 'recovery') {
          console.error('Invalid recovery parameters:', { token, type });
          setError('Link de recuperação inválido');
          return;
        }

        console.log('Recovery parameters found:', { token, type });
      } catch (error) {
        console.error('Error in setupAuth:', error);
        setError('Erro ao verificar o link de recuperação');
      }
    };

    setupAuth();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (newPassword.length < 6) {
      toast({
        title: 'Erro',
        description: 'A senha deve ter pelo menos 6 caracteres',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    try {
      console.log('Starting password update process...');

      // Update the password
      console.log('Attempting to update password...');
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error('Password update error:', error);
        throw error;
      }

      console.log('Password updated successfully:', data);

      toast({
        title: 'Senha atualizada',
        description: 'Sua senha foi atualizada com sucesso.',
      });

      // Small delay before sign out and redirect
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('Signing out...');
      await supabase.auth.signOut();

      console.log('Redirecting to login...');
      navigate('/auth');
    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar senha. Por favor, tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/auth');
  };

  const handleRequestNewLink = async () => {
    const email = prompt('Digite seu email para receber um novo link:');
    if (!email) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;

      toast({
        title: 'Link enviado',
        description: 'Se um usuário com este email existir, você receberá as instruções para redefinir sua senha.',
      });
    } catch (error: any) {
      console.error('Error requesting new link:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao enviar link de recuperação',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Redefinir Senha
          </h2>
          
          {error ? (
            <div className="space-y-6">
              <div className="bg-red-50 p-4 rounded-md">
                <p className="text-red-800">{error}</p>
              </div>
              <div className="space-y-4">
                <Button
                  type="button"
                  className="w-full"
                  onClick={handleRequestNewLink}
                  disabled={isLoading}
                >
                  Solicitar novo link
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleBackToLogin}
                  disabled={isLoading}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar para login
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Nova Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10"
                    placeholder="Digite sua nova senha"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-[#00A868] hover:bg-[#008F59] text-white"
                disabled={isLoading}
              >
                {isLoading ? 'Atualizando...' : 'Atualizar Senha'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword; 