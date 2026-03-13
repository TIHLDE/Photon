import { QueryClient, queryOptions, useQueryClient } from "@tanstack/react-query";
import { linkOptions, redirect } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { createPhotonAuthClient } from "@photon/auth/client";

export const authClient = createPhotonAuthClient(import.meta.env.VITE_AUTH_API_URL ?? "https://photon.tihlde.org");

export const authQueryOptions = queryOptions({
  queryKey: ["auth", "session"],
  queryFn: async () => {
    const session = await getIsomorphicAuthSession();
    if (session == null) {
      return null;
    }
    return session;
  },
});

export function useInvalidateAuth() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries(authQueryOptions);
}

export const getIsomorphicAuthSession = createIsomorphicFn()
  .client(async () => {
    const session = await authClient.getSession();
    if (session.error != null) {
      return null;
    }
    return session.data;
  })
  .server(async () => {
    const headers = getRequestHeaders();
    const session = await authClient.getSession({
      fetchOptions: {
        headers,
      },
    });
    if (session.error != null) {
      return null;
    }
    return session.data;
  });

/**
 * Checks if the user has write permission for the given app(s)
 * @param permissions the user permissions
 * @param app the app(s) to check agains
 * @param some if true, the user must only have write permission for one of the apps
 * @returns if the user has write or write_all permission
 */
export function userHasWritePermission(permissions: string[] | Set<string>, app: string | string[], some: boolean = false): boolean {
  // TODO: Replace app with rbac types from @tihlde/sdk once they're implemented
  const permSet = permissions instanceof Set ? permissions : new Set(permissions);
  if (!Array.isArray(app)) {
    return permSet.has(app);
  }
  if (some) {
    return app.some((p) => userHasWritePermission(permSet, p));
  }
  return app.every((p) => userHasWritePermission(permSet, p));
}

/**
 * Attempts to authenticate the user and redirects to the login page if not authenticated
 * @param request the request object from the loader
 * @returns auth object if authenticated
 * @throws redirect to login page if not authenticated
 */
export async function authClientWithRedirect({ url, queryClient }: { url: string; queryClient: QueryClient }) {
  const auth = await queryClient.ensureQueryData(authQueryOptions);
  if (!auth) {
    throw redirect(createLoginRedirectUrl(url));
  }
  return auth;
}

/**
 * Returns the URL to redirect to the login page with the current URL as the redirect target
 * @param request the current request object
 * @returns URL string to redirect to the login page
 */
export function createLoginRedirectUrl(url: string) {
  return linkOptions({
    to: "/logg-inn",
    search: {
      redirectTo: url,
    },
  });
}
