export const SERVICE_CATEGORIES = ["btp", "forage", "hydraulique", "hygiene", "maintenance", "etude", "transport", "autre"] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export type DefaultService = {
  code: string;
  name: string;
  category: ServiceCategory;
  description: string;
  unit: string;
  defaultUnitPrice: number;
  defaultTaxRate: number;
};

export const LUCEPRES_DEFAULT_SERVICES: readonly DefaultService[] = [
  { code: "HYD-ETU-001", name: "Étude et diagnostic hydraulique", category: "hydraulique", description: "Analyse initiale du besoin, du site et des contraintes techniques.", unit: "forfait", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "HYD-ADD-001", name: "Pose de conduite d’adduction", category: "hydraulique", description: "Pose et raccordement de conduite d’adduction d’eau.", unit: "ml", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "HYD-EQP-001", name: "Fourniture et pose d’équipement hydraulique", category: "hydraulique", description: "Fourniture, installation et essais d’équipement hydraulique.", unit: "unité", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "HYG-NET-001", name: "Nettoyage professionnel de site", category: "hygiene", description: "Nettoyage ponctuel ou de fin de chantier pour un site professionnel.", unit: "forfait", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "HYG-ASS-001", name: "Assainissement et hygiène de site", category: "hygiene", description: "Intervention d’hygiène, d’assainissement et de mise en propreté.", unit: "forfait", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "HYG-ENT-001", name: "Entretien périodique de site", category: "hygiene", description: "Prestation récurrente d’entretien selon la fréquence convenue.", unit: "mois", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "MNT-DIA-001", name: "Diagnostic de maintenance", category: "maintenance", description: "Contrôle d’un équipement ou d’une installation avant intervention.", unit: "forfait", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "MNT-PRE-001", name: "Maintenance préventive", category: "maintenance", description: "Visite d’entretien préventif avec vérifications et actions planifiées.", unit: "intervention", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "MNT-REP-001", name: "Réparation et réhabilitation", category: "maintenance", description: "Remise en état d’une installation ou d’un équipement existant.", unit: "intervention", defaultUnitPrice: 0, defaultTaxRate: 0 },
];

export function getMissingDefaultServices(existingCodes: readonly string[]) {
  const knownCodes = new Set(existingCodes);
  return LUCEPRES_DEFAULT_SERVICES.filter(service => !knownCodes.has(service.code));
}
