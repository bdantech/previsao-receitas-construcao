-- Function to update receivable status when buyer status changes
CREATE OR REPLACE FUNCTION public.update_receivable_status_on_buyer_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if buyer_status has changed
    IF (TG_OP = 'UPDATE' AND OLD.buyer_status IS DISTINCT FROM NEW.buyer_status) THEN
        -- Update receivables status based on new buyer status
        IF NEW.buyer_status = 'aprovado' THEN
            -- Update only receivables that are in 'enviado' status
            UPDATE public.receivables
            SET 
                status = 'elegivel_para_antecipacao',
                updated_at = NOW()
            WHERE 
                project_id = NEW.project_id 
                AND buyer_cpf = NEW.cpf 
                AND status = 'enviado';
        ELSIF NEW.buyer_status = 'reprovado' THEN
            -- Update only receivables that are in 'enviado' status
            UPDATE public.receivables
            SET 
                status = 'reprovado',
                updated_at = NOW()
            WHERE 
                project_id = NEW.project_id 
                AND buyer_cpf = NEW.cpf 
                AND status = 'enviado';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS update_receivable_status_trigger ON public.project_buyers;

-- Create the trigger
CREATE TRIGGER update_receivable_status_trigger
    AFTER UPDATE ON public.project_buyers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_receivable_status_on_buyer_change(); 