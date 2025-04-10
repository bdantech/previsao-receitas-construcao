-- Create webhook_endpoints table
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    url_path VARCHAR(255) NOT NULL UNIQUE,
    tag VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create webhooks_events table
CREATE TABLE IF NOT EXISTS public.webhooks_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    endpoint_id UUID NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processing_result JSONB,
    headers JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for webhook_endpoints
-- Only admins can manage webhook endpoints
CREATE POLICY admin_webhook_endpoints_policy ON public.webhook_endpoints
    USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    ));

-- Create RLS policies for webhooks_events
-- Only admins can view webhook events
CREATE POLICY admin_webhooks_events_policy ON public.webhooks_events
    USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    ));

-- Add indexes for better query performance
CREATE INDEX idx_webhooks_events_endpoint_id ON public.webhooks_events(endpoint_id);
CREATE INDEX idx_webhooks_events_created_at ON public.webhooks_events(created_at);
CREATE INDEX idx_webhooks_events_processed ON public.webhooks_events(processed); 