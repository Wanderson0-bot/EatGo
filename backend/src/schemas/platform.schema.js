const { z } = require("zod");

const updateNitrogoPlatformSchema = z.object({
  body: z.object({
    enabled: z.boolean()
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

module.exports = {
  updateNitrogoPlatformSchema
};
