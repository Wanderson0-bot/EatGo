// Schemas de atualização e criação do estabelecimento.
const { z } = require("zod");

const adminMenuItemSchema = z.object({
  nome: z.string().trim().min(2).max(100),
  descricao: z.string().trim().max(255).nullable().optional(),
  preco: z.number().positive(),
  preco_promocional: z.number().positive().nullable().optional(),
  imagem: z.string().trim().max(5_000_000).nullable().optional(),
  categoria: z.string().trim().max(100).nullable().optional(),
  ativo: z.boolean().optional()
});

const timeFieldSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Informe um horario valido.");

const establishmentCreateFields = {
  nome: z.string().trim().min(2).max(200),
  cnpj: z.string().trim().min(14).max(18).nullable().optional(),
  email: z.string().trim().email(),
  telefone: z.string().trim().min(8).max(20),
  endereco: z.string().trim().min(5).max(200),
  categoria: z.string().trim().min(2).max(100),
  horario_abertura: timeFieldSchema,
  horario_fechamento: timeFieldSchema,
  possui_entrega: z.boolean(),
  taxa_entrega: z.number().min(0).max(9999).nullable().optional(),
  descricao: z.string().trim().max(500).nullable().optional(),
  nitrogo_ativo: z.boolean().optional(),
  nitrogo_cupom_valor: z.number().min(0).max(9999).nullable().optional(),
  nitrogo_frete_gratis: z.boolean().optional(),
  logo_url: z.string().trim().max(5_000_000).nullable().optional(),
  cardapio_manual: z.string().trim().max(10000).nullable().optional(),
  cardapio_pdf_nome: z.string().trim().max(255).nullable().optional(),
  mercado_pago_access_token: z.string().trim().max(255).nullable().optional()
};

const createEstablishmentSchema = z.object({
  body: z.object(establishmentCreateFields),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const createAdminEstablishmentSchema = z.object({
  body: z.object({
    ...establishmentCreateFields,
    cnpj: z.string().trim().min(14).max(18).nullable().optional(),
    menu_items: z.array(adminMenuItemSchema).max(50).optional(),
    responsavel_nome: z.string().trim().min(2).max(200),
    senha_acesso: z.string().trim().min(8).max(128)
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const updateAdminEstablishmentSchema = z.object({
  body: z.object({
    email: z.string().trim().email().optional(),
    nome: z.string().trim().min(2).max(200).optional(),
    cnpj: z.string().trim().min(14).max(18).nullable().optional(),
    telefone: z.string().trim().min(8).max(20).optional(),
    endereco: z.string().trim().min(5).max(200).optional(),
    categoria: z.string().trim().min(2).max(100).optional(),
    horario_abertura: timeFieldSchema.optional(),
    horario_fechamento: timeFieldSchema.optional(),
    possui_entrega: z.boolean().optional(),
    taxa_entrega: z.number().min(0).max(9999).nullable().optional(),
    descricao: z.string().trim().max(500).nullable().optional(),
    nitrogo_ativo: z.boolean().optional(),
    nitrogo_cupom_valor: z.number().min(0).max(9999).nullable().optional(),
    nitrogo_frete_gratis: z.boolean().optional(),
    logo_url: z.string().trim().max(5_000_000).nullable().optional(),
    cardapio_manual: z.string().trim().max(10000).nullable().optional(),
    cardapio_pdf_nome: z.string().trim().max(255).nullable().optional(),
    mercado_pago_access_token: z.string().trim().max(255).nullable().optional(),
    menu_items: z.array(adminMenuItemSchema).max(50).optional(),
    responsavel_nome: z.string().trim().min(2).max(200).optional(),
    senha_acesso: z.string().trim().min(8).max(128).optional()
  }).refine((value) => Object.keys(value).length > 0, {
    message: "Informe pelo menos um campo para atualizar."
  }),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional()
});

const updateEstablishmentSchema = z.object({
  body: z.object({
    nome: z.string().trim().min(2).max(200).optional(),
    cnpj: z.string().trim().min(14).max(18).nullable().optional(),
    email: z.string().trim().email().optional(),
    telefone: z.string().trim().min(8).max(20).optional(),
    endereco: z.string().trim().min(5).max(200).optional(),
    categoria: z.string().trim().min(2).max(100).optional(),
    horario_abertura: timeFieldSchema.optional(),
    horario_fechamento: timeFieldSchema.optional(),
    possui_entrega: z.boolean().optional(),
    taxa_entrega: z.number().min(0).max(9999).nullable().optional(),
    descricao: z.string().trim().max(500).nullable().optional(),
    cardapio_manual: z.string().trim().max(10000).nullable().optional(),
    cardapio_pdf_nome: z.string().trim().max(255).nullable().optional(),
    mercado_pago_access_token: z.string().trim().max(255).nullable().optional()
  }).refine((value) => Object.keys(value).length > 0, {
    message: "Informe pelo menos um campo para atualizar."
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

module.exports = {
  createAdminEstablishmentSchema,
  createEstablishmentSchema,
  updateAdminEstablishmentSchema,
  updateEstablishmentSchema
};
