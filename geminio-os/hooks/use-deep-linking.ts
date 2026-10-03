import { useState, useCallback, useEffect } from "react";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";

export interface DeepLink {
  id: string;
  path: string;
  handler: (params: Record<string, any>) => void;
  description?: string;
}

export function useDeepLinking() {
  const router = useRouter();
  const [links, setLinks] = useState<DeepLink[]>([]);
  const [currentDeepLink, setCurrentDeepLink] = useState<string | null>(null);

  const registerDeepLink = useCallback(
    (path: string, handler: (params: Record<string, any>) => void, description?: string) => {
      const link: DeepLink = {
        id: `link-${Date.now()}`,
        path,
        handler,
        description,
      };

      setLinks((prev) => [...prev, link]);
      return link;
    },
    []
  );

  const handleDeepLink = useCallback(
    (url: string) => {
      try {
        const parsed = Linking.parse(url);
        const path = parsed.path || "";
        const params = (parsed.queryParams || {}) as Record<string, any>;

        setCurrentDeepLink(url);

        const link = links.find((l) => path.includes(l.path));
        if (link) {
          link.handler(params);
          return { success: true, path, params };
        }

        router.push(path as any);
        return { success: true, path, params };
      } catch (error) {
        console.error("Handle deep link error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to handle deep link",
        };
      }
    },
    [links, router]
  );

  const navigate = useCallback(
    (path: string, params?: Record<string, any>) => {
      try {
        const queryString = params ? `?${new URLSearchParams(params as any).toString()}` : "";
        const url = `${Linking.createURL(path)}${queryString}`;
        return handleDeepLink(url);
      } catch (error) {
        console.error("Navigate error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Navigation failed",
        };
      }
    },
    [handleDeepLink]
  );

  const getDeepLinkURL = useCallback(
    (path: string, params?: Record<string, any>) => {
      try {
        const queryString = params ? `?${new URLSearchParams(params as any).toString()}` : "";
        const url = `${Linking.createURL(path)}${queryString}`;
        return { success: true, url };
      } catch (error) {
        console.error("Get URL error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to get URL",
        };
      }
    },
    []
  );

  const shareDeepLink = useCallback(
    async (path: string, title: string, params?: Record<string, any>) => {
      try {
        const queryString = params ? `?${new URLSearchParams(params as any).toString()}` : "";
        const url = `${Linking.createURL(path)}${queryString}`;

        return {
          success: true,
          url,
          message: `Check this out: ${url}`,
        };
      } catch (error) {
        console.error("Share error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to share",
        };
      }
    },
    []
  );

  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleDeepLink(url);
    });

    return () => subscription.remove();
  }, [handleDeepLink]);

  useEffect(() => {
    const getInitialURL = async () => {
      const url = await Linking.getInitialURL();
      if (url != null) {
        handleDeepLink(url);
      }
    };

    getInitialURL();
  }, [handleDeepLink]);

  return {
    links,
    currentDeepLink,
    registerDeepLink,
    handleDeepLink,
    navigate,
    getDeepLinkURL,
    shareDeepLink,
  };
}
