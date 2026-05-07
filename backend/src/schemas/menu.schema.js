// Schemas de criação, edição e remoção de itens do cardápio.
const { z } = require("zod");

const menuItemBody = z.object({
  nome: z.string().trim().min(2).max(100),
  descricao: z.string().trim().max(255).nullable().optional(),
  preco: z.number().positive(),
  preco_promocional: z.number().positive().nullable().optional(),
  imagem: z.string().trim().max(255).nullable().optional(),
  categoria: z.string().trim().max(100).nullable().optional(),
  ativo: z.boolean().optional()
});

const createMenuItemSchema = z.object({
  body: menuItemBody,
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const updateMenuItemSchema = z.object({
  body: menuItemBody.partial().refine((value) => Object.keys(value).length > 0, {
    message: "Informe pelo menos um campo para atualizar."
  }),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional()
});

const menuItemParamsSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional()
});

module.exports = {
  createMenuItemSchema,
  updateMenuItemSchema,
  menuItemParamsSchema
};
