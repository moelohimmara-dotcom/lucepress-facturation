with open("/home/remote/lucepress-facturation/server/routers.ts", "r") as f:
    content = f.read()

old_preview = """    preview: adminProcedure
      .input(z.object({
        slug: z.string(),
        variables: z.record(z.string()).optional(),
      }))
      .mutation(({ input }) => renderEmailTemplate(input.slug, input.variables ?? {})),"""

new_preview = """    preview: adminProcedure
      .mutation(({ input }: { input: any }) => renderEmailTemplate(input.slug, input.variables ?? {})),"""

content = content.replace(old_preview, new_preview)

with open("/home/remote/lucepress-facturation/server/routers.ts", "w") as f:
    f.write(content)

print("Preview corrige.")
