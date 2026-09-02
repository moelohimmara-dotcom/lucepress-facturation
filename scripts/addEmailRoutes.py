import re

with open("/home/remote/lucepress-facturation/server/routers.ts", "r") as f:
    content = f.read()

# Ajouter import emailTemplates
import_line = 'import { createHeartbeatJob } from "./_core/heartbeat";'
email_import = import_line + '\nimport { listEmailTemplates, getEmailTemplateBySlug, createEmailTemplate, updateEmailTemplate, deleteEmailTemplate, renderEmailTemplate } from "./emailTemplates";'
content = content.replace(import_line, email_import)

# Ajouter le sous-routeur emailTemplates
email_block = '''
  /**
   * Gestion des templates d'e-mail (admin).
   */
  emailTemplates: router({
    list: adminProcedure.query(() => listEmailTemplates()),
    create: adminProcedure
      .input(z.object({
        slug: z.string().trim().min(1).max(100),
        name: z.string().trim().min(1).max(255),
        subject: z.string().trim().min(1).max(500),
        html: z.string().min(1),
        text: z.string().optional(),
        tenantId: z.number().int().positive().optional(),
      }))
      .mutation(({ input }) => createEmailTemplate(input)),
    update: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(1).max(255).optional(),
        subject: z.string().trim().min(1).max(500).optional(),
        html: z.string().min(1).optional(),
        text: z.string().optional(),
        enabled: z.enum(["oui", "non"]).optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateEmailTemplate(id, data);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteEmailTemplate(input.id)),
    preview: adminProcedure
      .input(z.object({
        slug: z.string(),
        variables: z.record(z.string()).optional(),
      }))
      .mutation(({ input }) => renderEmailTemplate(input.slug, input.variables ?? {})),
  }),
'''

# Insérer avant billing
content = content.replace("  billing: router({", email_block + "  billing: router({")

with open("/home/remote/lucepress-facturation/server/routers.ts", "w") as f:
    f.write(content)

print("Route emailTemplates ajoutee.")
