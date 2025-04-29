import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";

const PublicAnticipationContract: React.FC = () => {
  const { anticipationId } = useParams<{ anticipationId: string }>();
  const [htmlContract, setHtmlContract] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchHtmlContract = async () => {
    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke("company-anticipations", {
        body: {
          action: "getContractHtml",
          anticipationId,
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
        setHtmlContract(response.data.html);
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
    if (anticipationId) {
      fetchHtmlContract();
    }
  }, [anticipationId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!htmlContract) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-gray-500">Contrato não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Helmet>
        <title>Contrato de Antecipação</title>
        <meta name="description" content="Visualize o contrato de antecipação de forma pública e segura." />
        <meta property="og:title" content="Contrato de Antecipação" />
        <meta property="og:description" content="Acesse o contrato de antecipação diretamente pelo link público." />
        <meta property="og:type" content="document" />
        <meta property="og:url" content={window.location.href} />
      </Helmet>
      <div dangerouslySetInnerHTML={{ __html: htmlContract }} />
    </div>
  );
};

export default PublicAnticipationContract;