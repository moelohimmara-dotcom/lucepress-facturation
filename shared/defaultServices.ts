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

/**
 * Catalogue de départ Lucepress. Les tarifs BTP sont volontairement à 0 tant
 * qu’ils n’ont pas été validés par l’entreprise : les codes, unités et libellés
 * préremplissent les modèles, mais aucun prix métier n’est inventé.
 */
export const LUCEPRES_DEFAULT_SERVICES: readonly DefaultService[] = [
  { code: "BTP-PRE-001", name: "Préparation et installation de chantier", category: "btp", description: "Installation, sécurisation et préparation des zones de travaux.", unit: "forfait", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "BTP-FON-001", name: "Fondations et terrassement préparatoire", category: "btp", description: "Préparation des fondations et terrassement selon les métrés validés.", unit: "m³", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "BTP-ELV-001", name: "Élévation des ouvrages", category: "btp", description: "Élévation des murs, poteaux ou éléments structurels du projet.", unit: "m²", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "BTP-GOE-001", name: "Béton armé et gros œuvre", category: "btp", description: "Réalisation des éléments en béton armé et ouvrages de structure.", unit: "m³", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "BTP-DIA-001", name: "Diagnostic technique du bâti", category: "btp", description: "État des lieux, relevés et diagnostic préalable aux travaux.", unit: "forfait", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "BTP-DEP-001", name: "Dépose et évacuation contrôlée", category: "btp", description: "Dépose des éléments existants et évacuation selon les contraintes du site.", unit: "forfait", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "BTP-REN-001", name: "Réhabilitation des ouvrages existants", category: "btp", description: "Réparation et remise en état des ouvrages existants.", unit: "m²", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "BTP-FIN-001", name: "Finitions et remise en état", category: "btp", description: "Finitions, nettoyage de réception et remise en état des espaces.", unit: "forfait", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "BTP-IMP-001", name: "Implantation et préparation de site", category: "btp", description: "Implantation, préparation des emprises et organisation initiale du site.", unit: "forfait", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "BTP-ASS-001", name: "Assainissement et évacuation de site", category: "btp", description: "Travaux d’assainissement et gestion des évacuations du site.", unit: "forfait", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "BTP-ACC-001", name: "Voiries, accès et réseaux divers", category: "btp", description: "Création ou amélioration des accès, voiries et réseaux divers.", unit: "ml", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "BTP-EXT-001", name: "Aménagements extérieurs", category: "btp", description: "Aménagement et finition des espaces extérieurs du chantier.", unit: "m²", defaultUnitPrice: 0, defaultTaxRate: 0 },
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
