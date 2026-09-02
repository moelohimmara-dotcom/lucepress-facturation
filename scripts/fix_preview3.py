with open("/home/remote/lucepress-facturation/server/routers.ts", "r") as f:
    content = f.read()

old_preview = """    preview: adminProcedure
      .input(z.object({
        slug: z.string(),
      }))
      .mutation(({ input }) => renderEmailTemplate(input.slug, input.variables ?? {})),"""

new_preview = """    preview: adminProcedure
      .input(z.object({
        slug: z.string(),
      }))
      .mutation(({ input }: { input: { slug: string } }) => renderEmailTemplate(input.slug, input.variables ?? {})),"""

content = content.replace(old_preview, new_preview)

with open("/home/remote/lucepress-facturation/server/routers.ts", "w") as f:
    f.write(content)

print("Preview corrige.")
