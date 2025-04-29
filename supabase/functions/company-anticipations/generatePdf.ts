import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import ejs from 'https://esm.sh/ejs@3.1.9';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

type TProps = {
    anticipationId: string;
    cedente: {
        razaoSocial: string;
        cnpj: string;
    };
    recebiveis: {
        comprador: string;
        cpf: string;
        vencimento: string;
        valor: string;
        linkContrato?: string
    }[];
    valores: {
        valorTotalCreditosVencimento: number;
        precoPagoCessao: number;
        formaPagamento: string;
        descontos: number;
        valorLiquidoPagoAoCedente: number;
        dataPagamento: string;
    };
    user: {
        email: string;
    };
    refComponent?: React.RefObject<HTMLDivElement>;
}

export async function generateAndUploadHtml(props: TProps): Promise<{ htmlContent?:string, path?: string, error?: string }> {
    // Baixa o template
    const { data: templateFile, error: downloadError } = await supabase.storage
        .from('templates')
        .download('credit-contract.ejs');

    if (downloadError) {
        return { error: downloadError.message };
    }

    const templateText = await templateFile.text();

    const htmlOutput = await ejs.render(templateText, props);
    const normalizedHtml = htmlOutput.replace(/\s+/g, ' ').replace(/=\s*20/g, '');
    const filename = `contracts/contract-${props.anticipationId}.html`;
    const htmlBlob = new Blob([normalizedHtml], { type: 'text/html' });

    // Faz o upload do HTML para o Supabase Storage
    const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filename, htmlBlob, {
        contentType: 'text/html',
        upsert: true,
        });

    if (uploadError) {
        return { error: uploadError.message };
    }

    return { path: filename, htmlContent: normalizedHtml };
}
