-- Schema de banco de dados para o backend EatGo
-- Execute este arquivo em um banco MySQL compatível.

CREATE DATABASE eatgo;

USE eatgo;

CREATE TABLE estabelecimentos (
  id_estabelecimento INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(200) NOT NULL,
  cnpj VARCHAR(18) NULL,
  logo_url MEDIUMTEXT NULL,
  email VARCHAR(255) NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  endereco VARCHAR(200) NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  possui_entrega TINYINT(1) NOT NULL DEFAULT 0,
  taxa_entrega DECIMAL(10,2) NULL,
  descricao VARCHAR(500) NULL,
  nitrogo_ativo TINYINT(1) NOT NULL DEFAULT 0,
  nitrogo_cupom_valor DECIMAL(10,2) NULL,
  nitrogo_frete_gratis TINYINT(1) NOT NULL DEFAULT 0,
  cardapio_manual TEXT NULL,
  cardapio_pdf_nome VARCHAR(255) NULL,
  mercado_pago_access_token VARCHAR(255) NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  horario_abertura TIME,
  horario_fechamento TIME,
  PRIMARY KEY (id_estabelecimento),
  UNIQUE KEY uq_estabelecimentos_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE clientes (
  id_cliente INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(200) NOT NULL,
  email VARCHAR(255) NULL,
  telefone VARCHAR(20) NULL,
  endereco VARCHAR(200) NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_cliente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE configuracoes_plataforma (
  chave VARCHAR(100) NOT NULL,
  valor_json JSON NOT NULL,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (chave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO configuracoes_plataforma (chave, valor_json)
VALUES ('nitrogo', JSON_OBJECT('enabled', false))
ON DUPLICATE KEY UPDATE valor_json = valor_json;

CREATE TABLE usuarios_estabelecimento (
  id_usuario_estabelecimento INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_estabelecimento INT UNSIGNED NOT NULL,
  nome VARCHAR(200) NOT NULL,
  email VARCHAR(255) NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  papel VARCHAR(50) NOT NULL DEFAULT 'admin',
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  ultimo_login_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario_estabelecimento),
  UNIQUE KEY uq_usuarios_estabelecimento_email (email),
  KEY idx_usuarios_estabelecimento_estabelecimento (id_estabelecimento),
  CONSTRAINT fk_usuarios_estabelecimento_estabelecimento FOREIGN KEY (id_estabelecimento)
    REFERENCES estabelecimentos (id_estabelecimento)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS cardapio (
  id_cardapio INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_estabelecimento INT UNSIGNED NOT NULL,
  nome VARCHAR(100) NOT NULL,
  descricao VARCHAR(255) NULL,
  preco DECIMAL(10,2) NOT NULL,
  preco_promocional DECIMAL(10,2) NULL,
  imagem MEDIUMTEXT NULL,
  categoria VARCHAR(100) NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_cardapio),
  KEY idx_cardapio_estabelecimento (id_estabelecimento),
  CONSTRAINT fk_cardapio_estabelecimento FOREIGN KEY (id_estabelecimento)
    REFERENCES estabelecimentos (id_estabelecimento)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pedidos (
  id_pedido INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_cliente INT UNSIGNED NOT NULL,
  id_estabelecimento INT UNSIGNED NOT NULL,
  status ENUM('aguardando_pagamento','pago','confirmado','preparando','saiu_para_entrega','entregue','cancelado') NOT NULL DEFAULT 'aguardando_pagamento',
  pagamento_status ENUM('pendente','aprovado','rejeitado','cancelado') NOT NULL DEFAULT 'pendente',
  pagamento_gateway VARCHAR(50) NULL,
  pagamento_referencia VARCHAR(120) NULL,
  pagamento_id_externo VARCHAR(120) NULL,
  pagamento_checkout_url VARCHAR(500) NULL,
  cancelamento_status ENUM('nenhum','solicitado','em_analise','aprovado_total','aprovado_parcial','negado') NOT NULL DEFAULT 'nenhum',
  cancelamento_motivo VARCHAR(255) NULL,
  cancelamento_solicitado_em DATETIME NULL,
  cancelamento_analisado_em DATETIME NULL,
  cancelamento_valor_reembolso DECIMAL(10,2) NULL,
  cancelamento_taxa DECIMAL(10,2) NULL,
  cancelamento_analise_texto VARCHAR(255) NULL,
  pagamento_reembolsado_valor DECIMAL(10,2) NULL,
  pagamento_reembolsado_em DATETIME NULL,
  tipo_recebimento ENUM('entrega','retirada') NOT NULL DEFAULT 'entrega',
  forma_pagamento VARCHAR(30) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  desconto DECIMAL(10,2) NOT NULL DEFAULT 0,
  nitrogo_cupom_aplicado TINYINT(1) NOT NULL DEFAULT 0,
  nitrogo_frete_gratis_aplicado TINYINT(1) NOT NULL DEFAULT 0,
  taxa_entrega DECIMAL(10,2) NOT NULL DEFAULT 0,
  taxa_servico DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  observacao VARCHAR(255) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_pedido),
  KEY idx_pedidos_estabelecimento (id_estabelecimento),
  KEY idx_pedidos_cliente (id_cliente),
  UNIQUE KEY uq_pedidos_pagamento_referencia (pagamento_referencia),
  CONSTRAINT fk_pedidos_cliente FOREIGN KEY (id_cliente)
    REFERENCES clientes (id_cliente)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT fk_pedidos_estabelecimento FOREIGN KEY (id_estabelecimento)
    REFERENCES estabelecimentos (id_estabelecimento)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pedido_item (
  id_pedido_item INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_pedido INT UNSIGNED NOT NULL,
  id_cardapio INT UNSIGNED NOT NULL,
  quantidade INT UNSIGNED NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_pedido_item),
  KEY idx_pedido_item_pedido (id_pedido),
  KEY idx_pedido_item_cardapio (id_cardapio),
  CONSTRAINT fk_pedido_item_pedido FOREIGN KEY (id_pedido)
    REFERENCES pedidos (id_pedido)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_pedido_item_cardapio FOREIGN KEY (id_cardapio)
    REFERENCES cardapio (id_cardapio)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS carrinho (
  id_carrinho INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_cliente INT UNSIGNED NULL,
  id_estabelecimento INT UNSIGNED NULL,
  status ENUM('aberto','finalizado','cancelado') NOT NULL DEFAULT 'aberto',
  tipo_recebimento ENUM('entrega','retirada') NOT NULL DEFAULT 'entrega',
  forma_pagamento VARCHAR(30) NULL,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  taxa_entrega DECIMAL(10,2) NOT NULL DEFAULT 0,
  taxa_servico DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  observacao VARCHAR(255) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_carrinho),
  KEY idx_carrinho_cliente (id_cliente),
  KEY idx_carrinho_estabelecimento (id_estabelecimento),
  CONSTRAINT fk_carrinho_cliente FOREIGN KEY (id_cliente)
    REFERENCES clientes (id_cliente)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_carrinho_estabelecimento FOREIGN KEY (id_estabelecimento)
    REFERENCES estabelecimentos (id_estabelecimento)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS carrinho_item (
  id_carrinho_item INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_carrinho INT UNSIGNED NOT NULL,
  id_cardapio INT UNSIGNED NOT NULL,
  quantidade INT UNSIGNED NOT NULL DEFAULT 1,
  preco_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_carrinho_item),
  KEY idx_carrinho_item_carrinho (id_carrinho),
  KEY idx_carrinho_item_cardapio (id_cardapio),
  CONSTRAINT fk_carrinho_item_carrinho FOREIGN KEY (id_carrinho)
    REFERENCES carrinho (id_carrinho)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_carrinho_item_cardapio FOREIGN KEY (id_cardapio)
    REFERENCES cardapio (id_cardapio)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
