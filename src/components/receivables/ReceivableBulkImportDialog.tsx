import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, Info, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import * as XLSX from 'xlsx';
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ReceivableBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onReceivablesImported: () => void;
}

interface ReceivableData {
  buyer_name: string;
  buyer_cpf: string;
  amount: number;
  due_date: string;
  description?: string;
}

export function ReceivableBulkImportDialog({
  open,
  onOpenChange,
  projectId,
  onReceivablesImported,
}: ReceivableBulkImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewData, setPreviewData] = useState<ReceivableData[]>([]);
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    errors?: string[];
  }>({ success: 0, failed: 0 });
  
  const { toast } = useToast();
  const { session } = useAuth();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    
    try {
      const data = await readExcelFile(selectedFile);
      setPreviewData(data);
      setImportStep('preview');
    } catch (error) {
      console.error('Error parsing Excel file:', error);
      toast({
        title: "Erro ao ler arquivo",
        description: "O formato do arquivo não é suportado ou os dados não estão no formato esperado.",
        variant: "destructive"
      });
    }
  };

  const readExcelFile = (file: File): Promise<ReceivableData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          // Map to expected format with validation
          const receivables = jsonData.map((row: any) => {
            // Handle different possible column names
            const buyerName = row['Nome do Comprador'] || row['Comprador'] || row['Nome'];
            const buyerCpf = row['CPF'] || row['CPF do Comprador'];
            const amount = row['Valor'] || row['Montante'] || row['Quantia'];
            const dueDate = row['Data de Vencimento'] || row['Vencimento'] || row['Data'];
            const description = row['Descrição'] || row['Desc'] || '';
            
            return {
              buyer_name: buyerName,
              buyer_cpf: buyerCpf ? String(buyerCpf).replace(/\D/g, '') : '',
              amount: typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^\d.,]/g, '').replace(',', '.')),
              due_date: formatExcelDate(dueDate),
              description
            };
          });
          
          resolve(receivables);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  };

  const formatExcelDate = (dateValue: any): string => {
    // Handle Excel date serial numbers
    if (typeof dateValue === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
      return date.toISOString().split('T')[0];
    }
    
    // Handle string dates in DD/MM/YYYY format
    if (typeof dateValue === 'string' && dateValue.includes('/')) {
      const parts = dateValue.split('/');
      // Assuming DD/MM/YYYY format
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    
    // If it's already in YYYY-MM-DD format, return as is
    if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateValue;
    }
    
    // If all else fails, return today's date
    return new Date().toISOString().split('T')[0];
  };

  const validateData = (data: ReceivableData[]): boolean => {
    return data.every(item => 
      item.buyer_name && 
      item.buyer_cpf && 
      item.buyer_cpf.length >= 11 && 
      item.amount > 0 && 
      item.due_date
    );
  };

  const handleImport = async () => {
    if (!projectId || !session?.access_token || previewData.length === 0) return;
    
    setIsUploading(true);
    
    try {
      const successfulImports: number[] = [];
      const failedImports: number[] = [];
      const errors: string[] = [];
      
      // Process each receivable
      for (let i = 0; i < previewData.length; i++) {
        const receivable = previewData[i];
        
        try {
          const { data, error } = await supabase.functions.invoke('project-receivables', {
            headers: {
              Authorization: `Bearer ${session.access_token}`
            },
            body: {
              method: 'POST',
              endpoint: 'receivables',
              projectId,
              buyerName: receivable.buyer_name,
              buyerCpf: receivable.buyer_cpf,
              amount: receivable.amount,
              dueDate: receivable.due_date,
              description: receivable.description || ''
            }
          });
          
          if (error) {
            console.error(`Error importing receivable ${i + 1}:`, error);
            failedImports.push(i);
            errors.push(`Linha ${i + 1}: ${error.message || 'Erro desconhecido'}`);
          } else {
            successfulImports.push(i);
          }
        } catch (error) {
          console.error(`Exception importing receivable ${i + 1}:`, error);
          failedImports.push(i);
          errors.push(`Linha ${i + 1}: ${error.message || 'Erro desconhecido'}`);
        }
      }
      
      setImportResult({
        success: successfulImports.length,
        failed: failedImports.length,
        errors: errors.length > 0 ? errors : undefined
      });
      
      setImportStep('result');
      
      if (successfulImports.length > 0) {
        onReceivablesImported();
      }
      
    } catch (error) {
      console.error('Error during import:', error);
      toast({
        title: "Erro na importação",
        description: "Ocorreu um erro ao importar os recebíveis.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const resetDialog = () => {
    setFile(null);
    setPreviewData([]);
    setImportStep('upload');
    setImportResult({ success: 0, failed: 0 });
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {importStep === 'upload' && "Importar Recebíveis"}
            {importStep === 'preview' && "Confirmar Importação"}
            {importStep === 'result' && "Resultado da Importação"}
          </DialogTitle>
        </DialogHeader>
        
        {importStep === 'upload' && (
          <div className="space-y-6">
            <label htmlFor="file-upload" className="cursor-pointer block">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                  />
                  <span className="mt-2 block text-sm font-medium text-gray-700">
                    Clique para selecionar um arquivo Excel
                  </span>
                  <p className="text-xs text-gray-500 mt-2">
                    XLSX, XLS até 10MB
                  </p>
                </div>
              </div>
            </label>
            
            <div className="bg-blue-50 p-4 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Info className="h-5 w-5 text-blue-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">Formato esperado:</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>O arquivo deve conter as seguintes colunas:</p>
                    <ul className="list-disc pl-5 space-y-1 mt-1">
                      <li>Nome do Comprador</li>
                      <li>CPF</li>
                      <li>Valor</li>
                      <li>Data de Vencimento (formato: DD/MM/AAAA)</li>
                      <li>Descrição (opcional)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {importStep === 'preview' && (
          <div className="space-y-4">
            <div className="text-sm text-gray-500">
              {previewData.length} recebíveis encontrados no arquivo.
            </div>
            
            <div className="max-h-[300px] overflow-y-auto border rounded-md">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPF</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vencimento</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewData.slice(0, 10).map((item, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">{item.buyer_name}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">{item.buyer_cpf}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">R$ {item.amount.toFixed(2)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">{item.due_date}</td>
                    </tr>
                  ))}
                  {previewData.length > 10 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-center text-xs text-gray-500">
                        ...e mais {previewData.length - 10} recebíveis
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {!validateData(previewData) && (
              <Alert variant="destructive">
                <AlertDescription>
                  Alguns dados parecem estar incompletos ou incorretos. Verifique se todos os campos obrigatórios estão preenchidos corretamente.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="text-sm text-gray-500">
              Deseja prosseguir com a importação destes recebíveis?
            </div>
          </div>
        )}
        
        {importStep === 'result' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {importResult.success > 0 && (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2 rounded-md">
                  <Check className="h-5 w-5" />
                  <span>{importResult.success} recebíveis importados com sucesso</span>
                </div>
              )}
              
              {importResult.failed > 0 && (
                <div className="flex items-center gap-2 text-red-700 bg-red-50 px-3 py-2 rounded-md">
                  <X className="h-5 w-5" />
                  <span>{importResult.failed} falhas na importação</span>
                </div>
              )}
            </div>
            
            {importResult.errors && importResult.errors.length > 0 && (
              <div className="bg-red-50 p-4 rounded-md">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Erros encontrados:</h3>
                    <div className="mt-2 text-sm text-red-700 max-h-[150px] overflow-y-auto">
                      <ul className="list-disc pl-5 space-y-1">
                        {importResult.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        <DialogFooter>
          {importStep === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          )}
          
          {importStep === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setImportStep('upload')}>
                Voltar
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={isUploading || !validateData(previewData)}
              >
                {isUploading ? "Importando..." : "Confirmar Importação"}
              </Button>
            </>
          )}
          
          {importStep === 'result' && (
            <Button onClick={handleClose}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
