import { useState, useCallback } from "react";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface SocialAccount {
  id: string;
  platform: "twitter" | "linkedin" | "instagram" | "facebook" | "tiktok";
  username: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  connected: boolean;
  connectedAt: Date;
}

export interface SocialPost {
  id: string;
  platform: SocialAccount["platform"];
  content: string;
  media?: string[];
  scheduledFor?: Date;
  posted: boolean;
  postedAt?: Date;
  url?: string;
  engagement?: {
    likes: number;
    comments: number;
    shares: number;
  };
}

export function useSocialIntegration() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [isPosting, setIsPosting] = useState(false);

  // Connect social account
  const connectAccount = useCallback(
    async (platform: SocialAccount["platform"], username: string) => {
      try {
        // In production, this would use OAuth flow
        const account: SocialAccount = {
          id: `${platform}-${Date.now()}`,
          platform,
          username,
          connected: true,
          connectedAt: new Date(),
        };

        setAccounts((prev) => [account, ...prev]);

        // Save to storage
        const stored = await AsyncStorage.getItem("social_accounts");
        const allAccounts = stored ? JSON.parse(stored) : [];
        await AsyncStorage.setItem(
          "social_accounts",
          JSON.stringify([...allAccounts, account])
        );

        return { success: true, account };
      } catch (error) {
        console.error("Connect account error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to connect account",
        };
      }
    },
    []
  );

  // Disconnect account
  const disconnectAccount = useCallback(
    async (accountId: string) => {
      try {
        const updated = accounts.filter((a) => a.id !== accountId);
        setAccounts(updated);

        await AsyncStorage.setItem("social_accounts", JSON.stringify(updated));

        return { success: true };
      } catch (error) {
        console.error("Disconnect account error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to disconnect account",
        };
      }
    },
    [accounts]
  );

  // Post to social media
  const postToSocial = useCallback(
    async (
      accountId: string,
      content: string,
      media?: string[],
      scheduledFor?: Date
    ) => {
      try {
        setIsPosting(true);

        const account = accounts.find((a) => a.id === accountId);
        if (!account) {
          return { success: false, error: "Account not found" };
        }

        const post: SocialPost = {
          id: `post-${Date.now()}`,
          platform: account.platform,
          content,
          media,
          scheduledFor,
          posted: !scheduledFor,
          postedAt: scheduledFor ? undefined : new Date(),
          engagement: {
            likes: 0,
            comments: 0,
            shares: 0,
          },
        };

        setPosts((prev) => [post, ...prev]);

        // Save to storage
        const stored = await AsyncStorage.getItem("social_posts");
        const allPosts = stored ? JSON.parse(stored) : [];
        await AsyncStorage.setItem(
          "social_posts",
          JSON.stringify([...allPosts, post])
        );

        return { success: true, post };
      } catch (error) {
        console.error("Post error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to post",
        };
      } finally {
        setIsPosting(false);
      }
    },
    [accounts]
  );

  // Schedule post
  const schedulePost = useCallback(
    async (
      accountId: string,
      content: string,
      scheduledFor: Date,
      media?: string[]
    ) => {
      return postToSocial(accountId, content, media, scheduledFor);
    },
    [postToSocial]
  );

  // Get posts for account
  const getPostsForAccount = useCallback(
    (accountId: string) => {
      const account = accounts.find((a) => a.id === accountId);
      if (!account) return [];

      return posts.filter((p) => p.platform === account.platform);
    },
    [accounts, posts]
  );

  // Get scheduled posts
  const getScheduledPosts = useCallback(() => {
    return posts.filter((p) => p.scheduledFor && !p.posted);
  }, [posts]);

  // Get posted posts
  const getPostedPosts = useCallback(() => {
    return posts.filter((p) => p.posted);
  }, [posts]);

  // Delete post
  const deletePost = useCallback(
    async (postId: string) => {
      try {
        const updated = posts.filter((p) => p.id !== postId);
        setPosts(updated);

        await AsyncStorage.setItem("social_posts", JSON.stringify(updated));

        return { success: true };
      } catch (error) {
        console.error("Delete post error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to delete post",
        };
      }
    },
    [posts]
  );

  // Update post engagement
  const updateEngagement = useCallback(
    async (postId: string, engagement: SocialPost["engagement"]) => {
      try {
        const updated = posts.map((p) =>
          p.id === postId ? { ...p, engagement } : p
        );

        setPosts(updated);

        await AsyncStorage.setItem("social_posts", JSON.stringify(updated));

        return { success: true };
      } catch (error) {
        console.error("Update engagement error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to update engagement",
        };
      }
    },
    [posts]
  );

  // Get social statistics
  const getSocialStats = useCallback(() => {
    const totalPosts = posts.length;
    const totalEngagement = posts.reduce(
      (sum, p) => sum + (p.engagement?.likes || 0) + (p.engagement?.comments || 0),
      0
    );

    return {
      connectedAccounts: accounts.length,
      totalPosts,
      scheduledPosts: getScheduledPosts().length,
      postedPosts: getPostedPosts().length,
      totalEngagement,
      averageEngagement: totalPosts > 0 ? totalEngagement / totalPosts : 0,
    };
  }, [accounts, posts, getScheduledPosts, getPostedPosts]);

  return {
    accounts,
    posts,
    isPosting,
    connectAccount,
    disconnectAccount,
    postToSocial,
    schedulePost,
    getPostsForAccount,
    getScheduledPosts,
    getPostedPosts,
    deletePost,
    updateEngagement,
    getSocialStats,
  };
}
