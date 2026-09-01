import io, re

path = r"C:/Users/MARA/Documents/Lucepress doc/lucepress-facturation/server/db.ts"
src = io.open(path, encoding="utf-8").read()

TENANT = [
    "clients","projects","projectCosts","projectCostAttachments","services",
    "servicePriceRevisions","documents","documentLines","payments","paymentPromises",
    "companySettings","clientAttachments","clientActivities","integrationConnections",
    "agentDelegations","agentCampaigns","agentMessageJobs","agentTestEmailDeliveries",
    "agentAuditLogs","documentSequences",
]
TSET = set(TENANT)

# 1. import currentTenant
if "currentTenant" not in src:
    src = src.replace(
        'import { and, asc, desc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";',
        'import { and, asc, desc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";\nimport { currentTenant } from "./_core/tenantContext";',
        1,
    )

# 2. INSERT object literals: db.insert(T).values({  -> inject tenantId
for T in TENANT:
    pat = re.compile(r"((?:db|tx)\.insert\()" + re.escape(T) + r"(\)\.values\(\{)")
    def inj(m, T=T):
        return m.group(1) + T + m.group(2) + " tenantId: currentTenant(),"
    src, n = pat.subn(inj, src)
# 3. INSERT with bare variable (clientAttachments, projectCostAttachments use .values(input))
for T in ["clientAttachments","projectCostAttachments"]:
    pat = re.compile(r"((?:db|tx)\.insert\()" + re.escape(T) + r"(\)\.values\()(input)(\))")
    src = pat.sub(lambda m: m.group(1)+T+m.group(2)+"{ ...input, tenantId: currentTenant() }"+m.group(4), src)

# 4. documentValues object literal (createDocument)
src = src.replace(
    "const documentValues: typeof documents.$inferInsert = {",
    "const documentValues: typeof documents.$inferInsert = {\n      tenantId: currentTenant(),",
)

# 5. listServices seed: db.insert(services).values(missingDefaults) -> map tenantId
src = src.replace(
    "if (missingDefaults.length) await db.insert(services).values(missingDefaults);",
    "if (missingDefaults.length) await db.insert(services).values(missingDefaults.map(d => ({ ...d, tenantId: currentTenant() })));",
)

# 6. documentLines bulk map returns -> add tenantId inside returned object
# createDocument: return {\n            documentId,
src = src.replace(
    "return {\n            documentId,\n            position: index + 1,",
    "return {\n            tenantId: currentTenant(),\n            documentId,\n            position: index + 1,",
)
# updateDocument: return {\n        documentId,\n        position: index + 1,
src = src.replace(
    "return {\n        documentId,\n        position: index + 1,",
    "return {\n        tenantId: currentTenant(),\n        documentId,\n        position: index + 1,",
)
# createInvoiceFromQuote: return {\n      documentId: id, position: l.position,
src = src.replace(
    "return {\n      documentId: id, position: l.position,",
    "return {\n      tenantId: currentTenant(),\n      documentId: id, position: l.position,",
)

# 7. READS: for .from(T) with no existing .where before the trailing clause, inject tenant filter.
def inject_from_reads(src):
    out = []
    i = 0
    n = len(src)
    changed = 0
    while i < n:
        # find next earliest .from(T) for any tenant table
        best_idx = -1
        best_T = None
        for T in TENANT:
            idx = src.find(".from(" + T + ")", i)
            if idx != -1 and (best_idx == -1 or idx < best_idx):
                best_idx = idx
                best_T = T
        if best_idx == -1:
            out.append(src[i:]); break
        start = best_idx
        T = best_T
        # statement end: next ';' at paren-depth 0 after start
        depth = 0
        j = start
        stmt_end = n
        while j < n:
            c = src[j]
            if c == "(": depth += 1
            elif c == ")": depth -= 1
            elif c == ";" and depth <= 0:
                stmt_end = j; break
            j += 1
        stmt = src[start:stmt_end]
        if "eq(" + T + ".tenantId" in stmt:
            out.append(src[i:start+1]); i = start+1; continue
        # find earliest trailing clause token after .from(T)
        rest = src[start:stmt_end]
        tokens = [".orderBy(", ".groupBy(", ".limit(", ".$dynamic()"]
        positions = []
        for tok in tokens:
            p = rest.find(tok, len(".from("+T+")"))
            if p != -1: positions.append(p)
        if not positions:
            out.append(src[i:start+1]); i = start+1; continue
        pos = min(positions) + start
        # ensure no .where( already before pos (within stmt)
        if ".where(" in rest[:pos-start]:
            out.append(src[i:start+1]); i = start+1; continue
        # inject before token
        out.append(src[i:pos])
        out.append(".where(eq(" + T + ".tenantId, currentTenant()))")
        i = pos
        changed += 1
    return "".join(out), changed

src, c1 = inject_from_reads(src)

# 8. Single-eq .where(eq(T.X, Y)) -> wrap with tenant (only if no tenant filter yet in statement)
def wrap_where(src):
    out = []
    i = 0; n = len(src); changed = 0
    pat = re.compile(r"\.where\(eq\(([A-Za-z_]+)\.([A-Za-z_]+),\s*([^()]*?)\)\)")
    while i < n:
        m = pat.search(src, i)
        if not m:
            out.append(src[i:]); break
        T = m.group(1)
        if T not in TSET:
            out.append(src[i:m.end()]); i = m.end(); continue
        # statement bounds
        depth = 0; j = m.start(); end = n
        while j < n:
            c = src[j]
            if c == "(": depth += 1
            elif c == ")": depth -= 1
            elif c == ";" and depth <= 0:
                end = j; break
            j += 1
        if "eq(" + T + ".tenantId" in src[m.start():end]:
            out.append(src[i:m.end()]); i = m.end(); continue
        # avoid nested where inside a larger and(...) already containing tenant? simple guard above suffices
        repl = ".where(and(eq(" + T + "." + m.group(2) + ", " + m.group(3) + "), eq(" + T + ".tenantId, currentTenant())))"
        out.append(src[i:m.start()]); out.append(repl); i = m.end(); changed += 1
    return "".join(out), changed

src, c2 = wrap_where(src)

# 9. UPDATE/DELETE with simple .where(eq(T.X)) already handled by wrap_where (update/delete also use .where)
# But update/delete like .update(T).set({...}).where(eq(T.id, X)) -> wrap_where catches the .where(eq(T.id,X))

io.open(path, "w", encoding="utf-8", newline="").write(src)
print("from-inject:", c1, "where-wrap:", c2)
print("currentTenant occurrences:", src.count("currentTenant"))
