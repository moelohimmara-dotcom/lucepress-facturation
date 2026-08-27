export type CampaignFrequency = "daily" | "weekly";

export const WEEKDAY_LABELS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"] as const;

export function buildCampaignSchedule(input: { frequency: CampaignFrequency; time: string; weekday?: number }) {
  const match = /^(\d{2}):(\d{2})$/.exec(input.time);
  if (!match) throw new Error("Choisissez une heure au format HH:MM.");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error("L’heure de programmation est invalide.");
  if (input.frequency === "weekly" && (!Number.isInteger(input.weekday) || (input.weekday ?? -1) < 0 || (input.weekday ?? 7) > 6)) throw new Error("Choisissez le jour de la campagne hebdomadaire.");
  const cron = input.frequency === "daily" ? `0 ${minute} ${hour} * * *` : `0 ${minute} ${hour} * * ${input.weekday}`;
  const label = input.frequency === "daily"
    ? `Chaque jour à ${input.time} (Conakry)`
    : `Chaque ${WEEKDAY_LABELS[input.weekday!]!.toLowerCase()} à ${input.time} (Conakry)`;
  return { cron, label, timeZone: "Africa/Conakry" };
}
