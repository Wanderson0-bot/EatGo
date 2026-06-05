USE eatgo;

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS desconto DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER subtotal,
  ADD COLUMN IF NOT EXISTS nitrogo_cupom_aplicado TINYINT(1) NOT NULL DEFAULT 0 AFTER desconto,
  ADD COLUMN IF NOT EXISTS nitrogo_frete_gratis_aplicado TINYINT(1) NOT NULL DEFAULT 0 AFTER nitrogo_cupom_aplicado;
