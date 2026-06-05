USE eatgo;

ALTER TABLE estabelecimentos
  ADD COLUMN IF NOT EXISTS cnpj VARCHAR(18) NULL AFTER nome,
  ADD COLUMN IF NOT EXISTS mercado_pago_access_token VARCHAR(255) NULL AFTER cardapio_pdf_nome;

CREATE TABLE IF NOT EXISTS sessoes_aplicacao (
  id_sessao CHAR(64) NOT NULL,
  escopo ENUM('public','partner','admin') NOT NULL,
  id_usuario_estabelecimento INT UNSIGNED NULL,
  admin_subject VARCHAR(120) NULL,
  dados_json LONGTEXT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_sessao),
  KEY idx_sessoes_aplicacao_escopo (escopo),
  KEY idx_sessoes_aplicacao_usuario (id_usuario_estabelecimento),
  CONSTRAINT fk_sessoes_aplicacao_usuario FOREIGN KEY (id_usuario_estabelecimento)
    REFERENCES usuarios_estabelecimento (id_usuario_estabelecimento)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE pedidos
  ADD UNIQUE INDEX IF NOT EXISTS uq_pedidos_pagamento_referencia (pagamento_referencia);
