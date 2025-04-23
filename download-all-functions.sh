#!/bin/bash

# Lista com todas as funções
functions=(
  company-data
  admin-login
  auth
  create-first-admin
  document-management
  project-management
  update-company
  create-documents-bucket
  user-company-data
  admin-project-management
  execute-sql
  admin-project-buyers
  project-buyers
  project-receivables
  admin-receivables
  company-credit
  admin-company-credit
  admin-anticipations
  company-anticipations
  update-database-functions
  project-receivables-api
  company-api-credentials
  company-payment-plans
  admin-payment-plans
  add-billing-receivables
  indexes-management
  admin-boletos
  company-boletos
  storage-management
  admin-bank-accounts
  company-bank-accounts
  starkbank-integration
  company-kpi
  remove-billing-receivable
  webhook-endpoints
  webhook-events
  bulk-generate-boletos
  process-webhook-events
  update-bank-balances
  read-bank-account
)

# Loop para baixar todas
for fn in "${functions[@]}"; do
  echo "📥 Baixando função: $fn"
  npx supabase functions download "$fn"
done
