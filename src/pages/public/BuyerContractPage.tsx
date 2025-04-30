import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";

const PublicBuyerContract: React.FC = () => {
  const { buyerId } = useParams<{ projectId: string, buyerId: string }>();
  const [contractUrl, setContractUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchContract = async () => {
    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke("document-management", {
        body: {
          action: "getBuyerContractPdf",
          buyerId,
        },
      });

      if (response.error) {
        console.error("Error fetching contract HTML:", response.error);
        toast({
          title: "Erro ao carregar contrato",
          description: "Não foi possível obter o contrato da antecipação.",
          variant: "destructive",
        });
      } else {
        const blob = new Blob([response.data], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);

        setContractUrl(url);
      }
    } catch (error) {
      console.error("Error fetching contract:", error);
      toast({
        title: "Erro ao carregar contrato",
        description: "Ocorreu um erro ao buscar o contrato.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (buyerId) {
      fetchContract();
    }
  }, [buyerId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!contractUrl) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-gray-500">Contrato de comprador não encontrado.</p>
      </div>
    );
  }

  return (
    <div>
      <Helmet>
        <title>Contrato de Comprador</title>
        <meta name="description" content="Visualize o contrato do comprador de forma pública e segura." />
        <meta property="og:title" content="Contrato de Comprador" />
        <meta property="og:description" content="Acesse o contrato do comprador diretamente pelo link público." />
        <meta property="og:type" content="document" />
        <meta property="og:url" content={window.location.href} />
      </Helmet>
      <iframe
        src={contractUrl}
        title="Contrato de Comprador"
        className="w-full h-screen"
        allowFullScreen
      ></iframe>
    </div>
  );
};

export default PublicBuyerContract;