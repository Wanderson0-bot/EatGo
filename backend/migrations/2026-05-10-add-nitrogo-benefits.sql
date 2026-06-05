USE eatgo;

ALTER TABLE estabelecimentos
  ADD COLUMN IF NOT EXISTS nitrogo_ativo TINYINT(1) NOT NULL DEFAULT 0 AFTER descricao,
  ADD COLUMN IF NOT EXISTS nitrogo_cupom_valor DECIMAL(10,2) NULL AFTER nitrogo_ativo,
  ADD COLUMN IF NOT EXISTS nitrogo_frete_gratis TINYINT(1) NOT NULL DEFAULT 0 AFTER nitrogo_cupom_valor;
