import { trpc } from "@/lib/trpc";

export type SubscriptionAccess = {
  hasAccess: boolean;
  plan: string;
  status: string;
  trialEndsAt: string | null;
  daysRemaining: number | null;
};

export function useSubscriptionAccess() {
  const { data, isLoading } = trpc.subscription.checkAccess.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  return {
    access: data as SubscriptionAccess | undefined,
    isLoading,
  };
}
