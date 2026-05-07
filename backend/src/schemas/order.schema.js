// Schemas do fluxo de pedidos públicos e da atualização de status.
const { z } = require("zod");

const createOrderSchema = z.object({
  body: z.object({
    id_cliente: z.number().int().positive(),
    id_estabelecimento: z.number().int().positive(),
    tipo_recebimento: z.enum(["entrega", "retirada"]).default("entrega"),
    forma_pagamento: z.string().trim().min(2).max(30),
    observacao: z.string().trim().max(255).nullable().optional(),
    itens: z.array(
      z.object({
        id_cardapio: z.number().int().positive(),
        quantidade: z.number().int().positive().max(50)
      })
    ).min(1)
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const syncOrderPaymentSchema = z.object({
  body: z.object({
    pagamento_referencia: z.string().trim().min(5).max(120),
    payment_id: z.union([z.string().trim(), z.number().int().positive()]).optional(),
    status: z.string().trim().min(3).max(40),
    status_detail: z.string().trim().max(120).nullable().optional()
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const getClientOrdersSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id_cliente: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional()
});

const cancelClientOrderSchema = z.object({
  body: z.object({
    id_cliente: z.number().int().positive()
  }),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional()
});

const updateOrderStatusSchema = z.object({
  body: z.object({
    status: z.enum([
      "aberto",
      "confirmado",
      "preparando",
      "saiu_para_entrega",
      "entregue",
      "cancelado"
    ])
  }),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional()
});

module.exports = {
  cancelClientOrderSchema,
  createOrderSchema,
  getClientOrdersSchema,
  syncOrderPaymentSchema,
  updateOrderStatusSchema
};
