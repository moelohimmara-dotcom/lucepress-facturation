export type SavedClient = {
  id: number;
  companyName: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export function createQuoteUrlForClient(clientId: number) {
  return `/devis/nouveau?clientId=${clientId}`;
}

export function getPrefilledClientId(search: string) {
  const value = new URLSearchParams(search).get("clientId");
  return value && /^\d+$/.test(value) && Number(value) > 0 ? value : "";
}

export function findPrefilledClient<T extends SavedClient>(clients: T[], clientId: string) {
  return clients.find(client => client.id === Number(clientId));
}
