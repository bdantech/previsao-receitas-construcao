
-- Ensure the trigger function for updating contract status exists
CREATE OR REPLACE FUNCTION public.update_contract_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If contract_file_path was previously NULL or empty and now has a value,
  -- update the contract_status to 'a_analisar'
  IF (OLD.contract_file_path IS NULL OR OLD.contract_file_path = '') 
     AND (NEW.contract_file_path IS NOT NULL AND NEW.contract_file_path != '') THEN
    NEW.contract_status := 'a_analisar';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists on the project_buyers table
DROP TRIGGER IF EXISTS update_contract_status_trigger ON public.project_buyers;

CREATE TRIGGER update_contract_status_trigger
BEFORE UPDATE ON public.project_buyers
FOR EACH ROW
EXECUTE FUNCTION update_contract_status();
