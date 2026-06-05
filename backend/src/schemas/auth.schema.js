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
    email: z.string().trim().email()
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const partnerResetPasswordSchema = z.object({
  body: z.object({
    token: z.string().trim().min(32).max(256),
    senha: z.string().min(8).max(128)
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
  partnerResetPasswordSchema,
  adminLoginSchema
};
