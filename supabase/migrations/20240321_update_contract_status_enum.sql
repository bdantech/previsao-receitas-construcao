

-- Update contract_status enum to include 'a_analisar'
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'a_analisar';

-- Update existing records with 'a_enviar' status
UPDATE project_buyers SET contract_status = 'a_enviar' WHERE contract_status IS NULL; 

