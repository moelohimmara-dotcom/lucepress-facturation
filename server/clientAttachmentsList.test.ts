import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listClientAttachments: vi.fn(async () => [{ id: 11, clientId: 7, fileName: "contrat.pdf", contentType: "application/pdf", size: 4096, storageUrl: "/manus-storage/client-attachments/7/contrat.pdf" }]) }));
vi.mock("./db", () => ({ listClientAttachments: mocks.listClientAttachments }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("billing.clients.attachments.list", () => {
  it("retourne les métadonnées des documents liés au seul client demandé", async () => {
    const ctx = { user: { id: 1, openId: "admin-attachments", name: "Admin", email: "admin@example.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, tenantId: 1, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
    const files = await appRouter.createCaller(ctx).billing.clients.attachments.list({ clientId: 7 });
    expect(mocks.listClientAttachments).toHaveBeenCalledWith(7);
    expect(files[0]).toMatchObject({ clientId: 7, fileName: "contrat.pdf", contentType: "application/pdf" });
  });
});
