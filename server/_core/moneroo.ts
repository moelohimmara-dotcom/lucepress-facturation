import { createHmac } from "node:crypto";

const MONEROO_API_BASE = "https://api.moneroo.io/v1";

function getSecretKey(): string {
  const key = process.env.MONEROO_SECRET_KEY;
  if (!key) throw new Error("Clé API Moneroo non configurée (MONEROO_SECRET_KEY).");
  return key;
}

export function isMonerooConfigured(): boolean {
  return Boolean(process.env.MONEROO_SECRET_KEY);
}

export type MonerooPaymentInit = {
  amount: number;
  currency: string;
  description: string;
  customer: {
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
  };
  return_url: string;
  metadata?: Record<string, string>;
};

export type MonerooInitResponse = {
  id: string;
  checkout_url: string;
};

export async function initializeMonerooPayment(
  input: MonerooPaymentInit
): Promise<MonerooInitResponse> {
  const res = await fetch(`${MONEROO_API_BASE}/payments/initialize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getSecretKey()}`,
      Accept: "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Moneroo: échec d'initialisation du paiement (${res.status}). ${text}`
    );
  }

  const json = (await res.json()) as {
    data?: { id: string; checkout_url: string };
  };
  if (!json.data?.checkout_url) {
    throw new Error("Moneroo: réponse d'initialisation invalide.");
  }
  return json.data;
}

export type MonerooVerifyResponse = {
  id: string;
  status: string;
  amount: number;
  currency: { code: string };
  metadata?: Record<string, string> | null;
};

export async function verifyMonerooPayment(
  paymentId: string
): Promise<MonerooVerifyResponse> {
  const res = await fetch(`${MONEROO_API_BASE}/payments/${paymentId}/verify`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(
      `Moneroo: échec de vérification du paiement (${res.status}).`
    );
  }

  const json = (await res.json()) as { data?: MonerooVerifyResponse };
  if (!json.data) {
    throw new Error("Moneroo: réponse de vérification invalide.");
  }
  return json.data;
}

export function verifyMonerooWebhookSignature(
  payload: string,
  signature: string | undefined
): boolean {
  const secret = process.env.MONEROO_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const computed = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return computed === signature;
}
