/**
 * Formats a CNPJ string (company registration number in Brazil)
 * Example: 12345678000199 -> 12.345.678/0001-99
 */
export const formatCNPJ = (cnpj: string): string => {
  if (!cnpj) return '';
  
  // Remove any non-numeric characters
  const cleanCNPJ = cnpj.replace(/\D/g, '');
  
  // Apply the CNPJ format
  if (cleanCNPJ.length === 14) {
    return cleanCNPJ.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      '$1.$2.$3/$4-$5'
    );
  }
  
  // Return the original value if it's not a 14-digit number
  return cnpj;
};

/**
 * Formats a CPF string (Brazilian individual taxpayer registry)
 * Example: 12345678900 -> 123.456.789-00
 */
export const formatCPF = (cpf: string): string => {
  if (!cpf) return '';
  
  // Remove any non-numeric characters
  const cleanCPF = cpf.replace(/\D/g, '');
  
  // Apply the CPF format
  if (cleanCPF.length === 11) {
    return cleanCPF.replace(
      /(\d{3})(\d{3})(\d{3})(\d{2})/,
      '$1.$2.$3-$4'
    );
  }
  
  // Return the original value if it's not an 11-digit number
  return cpf;
};

export function maskCPF(value: string): string {
  const onlyNumbers = value.replace(/\D/g, '');
  
  if (onlyNumbers.length <= 3) {
    return onlyNumbers;
  }
  
  if (onlyNumbers.length <= 6) {
    return `${onlyNumbers.slice(0, 3)}.${onlyNumbers.slice(3)}`;
  }
  
  if (onlyNumbers.length <= 9) {
    return `${onlyNumbers.slice(0, 3)}.${onlyNumbers.slice(3, 6)}.${onlyNumbers.slice(6)}`;
  }
  
  return `${onlyNumbers.slice(0, 3)}.${onlyNumbers.slice(3, 6)}.${onlyNumbers.slice(6, 9)}-${onlyNumbers.slice(9, 11)}`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}
