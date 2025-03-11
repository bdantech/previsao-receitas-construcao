
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
