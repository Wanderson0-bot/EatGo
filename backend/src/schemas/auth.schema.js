// Schemas de entrada das rotas de autenticação.
const { z } = require("zod");

const partnerLoginSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
    senha: z.string().min(8).max(128)
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const partnerRecoverPasswordSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
    cnpj: z.string().trim().min(14).max(18),
    nova_senha: z.string().min(8).max(128)
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const adminLoginSchema = z.object({
  body: z.object({
    senha: z.string().optional()
  }).optional(),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

module.exports = {
  partnerLoginSchema,
  partnerRecoverPasswordSchema,
  adminLoginSchema
};
