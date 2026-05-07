// Schemas de atualização e criação do estabelecimento.
const { z } = require("zod");

const establishmentCreateFields = {
  nome: z.string().trim().min(2).max(200),
  cnpj: z.string().trim().min(14).max(18).nullable().optional(),
  email: z.string().trim().email(),
  telefone: z.string().trim().min(8).max(20),
  endereco: z.string().trim().min(5).max(200),
  categoria: z.string().trim().min(2).max(100),
  horario_funcionamento: z.string().trim().min(2).max(100),
  possui_entrega: z.boolean(),
  taxa_entrega: z.number().min(0).max(9999).nullable().optional(),
  descricao: z.string().trim().max(500).nullable().optional(),
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
    cnpj: z.string().trim().min(14).max(18),
    responsavel_nome: z.string().trim().min(2).max(200),
    senha_acesso: z.string().trim().min(8).max(128)
  }),
  params: z.object({}).optional(),
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
    horario_funcionamento: z.string().trim().min(2).max(100).optional(),
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
  updateEstablishmentSchema
};
