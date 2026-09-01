import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: (data) => {
      if (data?.redirectTo && typeof window !== "undefined") {
        window.location.href = data.redirectTo;
      }
      // Broadcast logout to other tabs via localStorage (storage events are cross-tab)
      try {
        localStorage.setItem("lucepress-logged-out", Date.now().toString());
      } catch {}
      utils.auth.me.setData(undefined, null);
    },
  });

  // Single-shot listener for cross-tab logout broadcast
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "lucepress-logged-out") {
        utils.auth.me.setData(undefined, null);
        utils.auth.me.invalidate();
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [utils]);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
    },
  });

  const changePasswordMutation = trpc.auth.changePassword.useMutation();

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED") {
        return;
      }
      throw error;
    } finally {
      try {
        sessionStorage.removeItem("lucepress-session");
      } catch {}
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    try {
      if (meQuery.data) {
        localStorage.setItem("lucepress-user", JSON.stringify(meQuery.data));
      } else {
        localStorage.removeItem("lucepress-user");
      }
    } catch {}
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;
    if (redirectPath) {
      window.location.href = redirectPath;
    }
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    changePassword: changePasswordMutation.mutateAsync,
    logout,
    refresh: () => meQuery.refetch(),
  };
}
