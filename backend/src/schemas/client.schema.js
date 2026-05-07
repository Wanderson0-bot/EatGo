const { z } = require("zod");

const createClientSchema = z.object({
  body: z.object({
    nome: z.string().trim().min(2).max(200),
    email: z.string().email().trim(),
    telefone: z.string().trim().min(8).max(20),
    endereco: z.string().trim().min(5).max(200),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const getClientSchema = z.object({
  query: z.object({
    email: z.string().email().trim(),
  }),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

module.exports = {
  createClientSchema,
  getClientSchema,
};
