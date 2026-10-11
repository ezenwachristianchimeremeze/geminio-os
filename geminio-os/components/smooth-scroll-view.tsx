/**
 * Smooth Scroll View Component
 * 
 * Provides smooth scrolling with auto-scroll to bottom
 * for chat interfaces and message lists
 */

import React, { useRef, useEffect } from "react";
import { ScrollView, View, ScrollViewProps, LayoutChangeEvent, Text } from "react-native";

interface SmoothScrollViewProps extends ScrollViewProps {
  children: React.ReactNode;
  autoScrollToBottom?: boolean;
  scrollDelay?: number; // delay before auto-scroll
}

/**
 * Smooth scroll view that auto-scrolls to bottom when content changes
 */
export const SmoothScrollView = React.forwardRef<
  ScrollView,
  SmoothScrollViewProps
>(
  (
    {
      children,
      autoScrollToBottom = true,
      scrollDelay = 100,
      ...props
    },
    ref
  ) => {
    const scrollViewRef = useRef<ScrollView>(null);
    const contentHeightRef = useRef(0);
    const scrollViewHeightRef = useRef(0);

    // Handle content size changes
    const handleContentSizeChange = (contentWidth: number, contentHeight: number) => {
      contentHeightRef.current = contentHeight;

      if (autoScrollToBottom && scrollViewHeightRef.current > 0) {
        // Delay scroll to ensure layout is complete
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, scrollDelay);
      }
    };

    // Handle scroll view layout changes
    const handleLayout = (event: LayoutChangeEvent) => {
      scrollViewHeightRef.current = event.nativeEvent.layout.height;
    };

    // Combine refs
    useEffect(() => {
      if (ref) {
        if (typeof ref === "function") {
          ref(scrollViewRef.current);
        } else {
          ref.current = scrollViewRef.current;
        }
      }
    }, [ref]);

    return (
      <ScrollView
        ref={scrollViewRef}
        onContentSizeChange={handleContentSizeChange}
        onLayout={handleLayout}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        {...props}
      >
        {children}
      </ScrollView>
    );
  }
);

SmoothScrollView.displayName = "SmoothScrollView";

/**
 * Hook for smooth scrolling
 */
export function useSmoothScroll(
  scrollViewRef: React.RefObject<ScrollView>
) {
  const scrollToBottom = (animated: boolean = true) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated });
    }
  };

  const scrollToTop = (animated: boolean = true) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated });
    }
  };

  const scrollToOffset = (offset: number, animated: boolean = true) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: offset, animated });
    }
  };

  return {
    scrollToBottom,
    scrollToTop,
    scrollToOffset,
  };
}

/**
 * Scroll to bottom button component
 */
interface ScrollToBottomButtonProps {
  scrollViewRef: React.RefObject<ScrollView>;
  isVisible?: boolean;
  className?: string;
}

export function ScrollToBottomButton({
  scrollViewRef,
  isVisible = true,
  className,
}: ScrollToBottomButtonProps) {
  const { scrollToBottom } = useSmoothScroll(scrollViewRef);

  if (!isVisible) return null;

  return (
    <View className={className}>
      <View
        className="bg-primary rounded-full p-2 items-center justify-center shadow-lg"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
        }}
      >
        <Text
          className="text-primaryForeground text-lg"
          onPress={() => scrollToBottom(true)}
        >
          ↓
        </Text>
      </View>
    </View>
  );
}
