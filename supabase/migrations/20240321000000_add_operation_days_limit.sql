-- Add operation_days_limit column to company_credit_analysis table
ALTER TABLE company_credit_analysis
ADD COLUMN operation_days_limit INTEGER DEFAULT 180;

-- Update existing records to have a default value for operation_days_limit
UPDATE company_credit_analysis
SET operation_days_limit = 180
WHERE operation_days_limit IS NULL; 