USE eatgo;

UPDATE pedidos
SET status = 'pago'
WHERE status = 'aberto';

ALTER TABLE pedidos
  MODIFY COLUMN status ENUM(
    'aguardando_pagamento',
    'pago',
    'confirmado',
    'preparando',
    'saiu_para_entrega',
    'entregue',
    'cancelado'
  ) NOT NULL DEFAULT 'aguardando_pagamento',
  ADD COLUMN IF NOT EXISTS cancelamento_status ENUM(
    'nenhum',
    'solicitado',
    'em_analise',
    'aprovado_total',
    'aprovado_parcial',
    'negado'
  ) NOT NULL DEFAULT 'nenhum' AFTER pagamento_checkout_url,
  ADD COLUMN IF NOT EXISTS cancelamento_motivo VARCHAR(255) NULL AFTER cancelamento_status,
  ADD COLUMN IF NOT EXISTS cancelamento_solicitado_em DATETIME NULL AFTER cancelamento_motivo,
  ADD COLUMN IF NOT EXISTS cancelamento_analisado_em DATETIME NULL AFTER cancelamento_solicitado_em,
  ADD COLUMN IF NOT EXISTS cancelamento_valor_reembolso DECIMAL(10,2) NULL AFTER cancelamento_analisado_em,
  ADD COLUMN IF NOT EXISTS cancelamento_taxa DECIMAL(10,2) NULL AFTER cancelamento_valor_reembolso,
  ADD COLUMN IF NOT EXISTS cancelamento_analise_texto VARCHAR(255) NULL AFTER cancelamento_taxa,
  ADD COLUMN IF NOT EXISTS pagamento_reembolsado_valor DECIMAL(10,2) NULL AFTER cancelamento_analise_texto,
  ADD COLUMN IF NOT EXISTS pagamento_reembolsado_em DATETIME NULL AFTER pagamento_reembolsado_valor;
