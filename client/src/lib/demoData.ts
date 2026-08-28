export const demoClients = [
  { id: 101, companyName: "Société Bati Guinée", contactName: "M. Ibrahima Bah", email: "ibrahima@batiguinee.com", phone: "+224 622 123 456", address: "Kaloum, Conakry" },
  { id: 102, companyName: "Mairie de Kankan", contactName: "Mme Fatoumata Sylla", email: "contact@mairie-kankan.gov.gn", phone: "+224 624 987 654", address: "Centre-ville, Kankan" },
  { id: 103, companyName: "Forage & Hydraulique SARL", contactName: "M. Jean Kamano", email: "jean@forage-hydraulique.gn", phone: "+224 610 555 789", address: "Ratoma, Conakry" },
];

export const demoDocuments = [
  { id: 201, kind: "devis" as const, number: "DEV-2026-001", status: "accepte" as const, total: 45000000, clientId: 101, clientName: "Société Bati Guinée", projectName: "Forage Kankan 80m", issueDate: new Date("2026-08-10"), dueDate: null, validUntil: new Date("2026-09-10"), isOverdue: false, balanceDue: 0, paidAmount: 0 },
  { id: 202, kind: "facture" as const, number: "FAC-2026-014", status: "en_retard" as const, total: 28500000, clientId: 102, clientName: "Mairie de Kankan", projectName: "Adduction eau - Forage", issueDate: new Date("2026-07-15"), dueDate: new Date("2026-08-01"), validUntil: null, isOverdue: true, balanceDue: 28500000, paidAmount: 0 },
  { id: 203, kind: "facture" as const, number: "FAC-2026-015", status: "partiellement_paye" as const, total: 12000000, clientId: 103, clientName: "Forage & Hydraulique SARL", projectName: "Maintenance pompe", issueDate: new Date("2026-08-20"), dueDate: new Date("2026-09-05"), validUntil: null, isOverdue: false, balanceDue: 4000000, paidAmount: 8000000 },
];

export function isDemoMode() {
  try { return localStorage.getItem("lucepress-dev-bypass") === "true"; } catch { return false; }
}
