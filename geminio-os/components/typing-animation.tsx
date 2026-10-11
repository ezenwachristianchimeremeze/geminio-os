/**
 * Typing Animation Component
 * 
 * Displays animated typing effect for AI responses
 * Makes conversations feel more natural and human-like
 */

import React, { useState, useEffect } from "react";
import { View, Text, Animated, ScrollView } from "react-native";
import { useColors } from "@/hooks/use-colors";

interface TypingAnimationProps {
  text: string;
  speed?: number; // milliseconds per character
  onComplete?: () => void;
  className?: string;
}

/**
 * Character-by-character typing animation
 */
export function TypingAnimation({
  text,
  speed = 30,
  onComplete,
  className,
}: TypingAnimationProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const colors = useColors();

  useEffect(() => {
    if (displayedText.length === text.length) {
      setIsComplete(true);
      onComplete?.();
      return;
    }

    const timer = setTimeout(() => {
      setDisplayedText(text.slice(0, displayedText.length + 1));
    }, speed);

    return () => clearTimeout(timer);
  }, [displayedText, text, speed, onComplete]);

  return (
    <View className={className}>
      <Text className="text-base text-foreground leading-relaxed">
        {displayedText}
        {!isComplete && <TypingCursor />}
      </Text>
    </View>
  );
}

/**
 * Animated typing cursor
 */
function TypingCursor() {
  const colors = useColors();
  const opacity = new Animated.Value(1);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View style={{ opacity }}>
      <Text className="text-base font-bold" style={{ color: colors.primary }}>
        |
      </Text>
    </Animated.View>
  );
}

/**
 * Typing indicator (three dots animation)
 */
interface TypingIndicatorProps {
  className?: string;
}

export function TypingIndicator({ className }: TypingIndicatorProps) {
  const colors = useColors();
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev === ".") return "..";
        if (prev === "..") return "...";
        return ".";
      });
    }, 400);

    return () => clearInterval(interval);
  }, []);

  return (
    <View className={className}>
      <Text
        className="text-sm text-muted"
        style={{ color: colors.muted }}
      >
        AI is typing{dots}
      </Text>
    </View>
  );
}

/**
 * Animated message bubble
 */
interface AnimatedMessageBubbleProps {
  message: string;
  isUser: boolean;
  isTyping?: boolean;
  onTypingComplete?: () => void;
  className?: string;
}

export function AnimatedMessageBubble({
  message,
  isUser,
  isTyping = false,
  onTypingComplete,
  className,
}: AnimatedMessageBubbleProps) {
  const colors = useColors();
  const scaleAnim = new Animated.Value(0.8);
  const opacityAnim = new Animated.Value(0);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const bubbleColor = isUser ? colors.primary : colors.surface;
  const textColor = isUser ? "white" : colors.foreground;

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }],
        opacity: opacityAnim,
      }}
      className={className}
    >
      <View
        className={`rounded-2xl px-4 py-3 max-w-xs ${
          isUser ? "bg-primary self-end" : "bg-surface self-start"
        }`}
        style={{
          backgroundColor: bubbleColor,
        }}
      >
        {isTyping ? (
          <TypingAnimation
            text={message}
            speed={30}
            onComplete={onTypingComplete}
            className="text-sm"
          />
        ) : (
          <Text
            className="text-sm leading-relaxed"
            style={{ color: textColor }}
          >
            {message}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

/**
 * Smooth scroll to bottom animation
 */
export function useSmoothScrollAnimation(scrollViewRef: React.RefObject<ScrollView>) {
  const scrollToBottom = (animated: boolean = true) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated });
    }
  };

  return { scrollToBottom };
}

/**
 * Message entrance animation
 */
interface MessageEntranceProps {
  children: React.ReactNode;
  delay?: number;
}

export function MessageEntrance({ children, delay = 0 }: MessageEntranceProps) {
  const translateY = new Animated.Value(20);
  const opacity = new Animated.Value(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [translateY, opacity, delay]);

  return (
    <Animated.View
      style={{
        transform: [{ translateY }],
        opacity,
      }}
    >
      {children}
    </Animated.View>
  );
}
