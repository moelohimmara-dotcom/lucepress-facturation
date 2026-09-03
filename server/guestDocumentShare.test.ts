import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDocumentShareToken, GUEST_DOCUMENT_INVALID_MESSAGE } from "../shared/documentShare";

const mocks = vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-de-test-uniquement-32-caracteres-mini";
  return {
    getGuestDocumentByShareToken: vi.fn(),
    respondToGuestQuoteByShareToken: vi.fn(),
  };
});

vi.mock("./db", () => mocks);

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { __resetGuestShareRateLimitForTests } from "./_core/guestShareRateLimit";

function guestCtx(ip = "198.51.100.7"): TrpcContext {
  return {
    user: null,
    tenantId: null,
    req: {
      headers: {},
      ip,
      protocol: "https",
      socket: { remoteAddress: ip },
      get: () => undefined,
    } as TrpcContext["req"],
    res: { cookie: () => undefined, clearCookie: () => undefined } as unknown as TrpcContext["res"],
  } as TrpcContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetGuestShareRateLimitForTests();
});

describe("guest.getDocument / respondToQuote", () => {
  it("retourne le document pour un jeton valide", async () => {
    const token = createDocumentShareToken();
    mocks.getGuestDocumentByShareToken.mockResolvedValue({
      document: { number: "DEV-1", kind: "devis", canRespond: true, status: "envoye" },
      company: { legalName: "Lucepres Sarl" },
      share: { expiresAt: new Date("2026-12-01") },
    });
    const caller = appRouter.createCaller(guestCtx());
    const res = await caller.guest.getDocument({ token });
    expect(res.document.number).toBe("DEV-1");
    expect(mocks.getGuestDocumentByShareToken).toHaveBeenCalledWith(token);
  });

  it("renvoie un message générique si le jeton est invalide (pas d’énumération)", async () => {
    const token = createDocumentShareToken();
    mocks.getGuestDocumentByShareToken.mockRejectedValue(new Error(GUEST_DOCUMENT_INVALID_MESSAGE));
    const caller = appRouter.createCaller(guestCtx());
    await expect(caller.guest.getDocument({ token })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: GUEST_DOCUMENT_INVALID_MESSAGE,
    });
  });

  it("accepte un devis via le jeton guest", async () => {
    const token = createDocumentShareToken();
    mocks.respondToGuestQuoteByShareToken.mockResolvedValue({
      success: true,
      status: "accepte",
      number: "DEV-1",
    });
    const caller = appRouter.createCaller(guestCtx());
    const res = await caller.guest.respondToQuote({ token, decision: "accepte" });
    expect(res).toMatchObject({ success: true, status: "accepte" });
  });

  it("applique le rate-limit guest après trop de tentatives", async () => {
    const token = createDocumentShareToken();
    mocks.getGuestDocumentByShareToken.mockRejectedValue(new Error(GUEST_DOCUMENT_INVALID_MESSAGE));
    const caller = appRouter.createCaller(guestCtx("203.0.113.99"));
    for (let i = 0; i < 40; i += 1) {
      await expect(caller.guest.getDocument({ token })).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    await expect(caller.guest.getDocument({ token })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });
});
