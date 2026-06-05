USE eatgo;

CREATE TABLE IF NOT EXISTS configuracoes_plataforma (
  chave VARCHAR(100) NOT NULL,
  valor_json JSON NOT NULL,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (chave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO configuracoes_plataforma (chave, valor_json)
VALUES ('nitrogo', JSON_OBJECT('enabled', false))
ON DUPLICATE KEY UPDATE valor_json = valor_json;
