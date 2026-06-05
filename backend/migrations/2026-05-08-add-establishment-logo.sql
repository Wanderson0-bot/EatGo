USE eatgo;

ALTER TABLE estabelecimentos
  ADD COLUMN IF NOT EXISTS logo_url VARCHAR(255) NULL AFTER cnpj;
