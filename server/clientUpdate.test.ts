import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ updateClient: vi.fn(async () => ({ success: true })) }));
vi.mock("./db", () => ({ updateClient: mocks.updateClient }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("billing.clients.update", () => {
  it("transmet les coordonnées modifiées au service sécurisé", async () => {
    const ctx = { user: { id: 1, openId: "admin-update", name: "Admin", email: "admin@example.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
    await appRouter.createCaller(ctx).billing.clients.update({ id: 8, companyName: "Bati Guinée Révisé", contactName: "Mamadou Diallo", email: "mamadou@example.com", phone: "+224 600 00 00 00", address: "Conakry", taxId: "NIF-8", notes: "Facturation mensuelle" });
    expect(mocks.updateClient).toHaveBeenCalledWith(8, expect.objectContaining({ companyName: "Bati Guinée Révisé", address: "Conakry" }));
  });
});
