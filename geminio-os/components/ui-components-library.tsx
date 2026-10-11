import React from 'react';
import { View, Text, ScrollView, Pressable, Animated, GestureResponderEvent } from 'react-native';
import { cn } from '@/lib/utils';

/**
 * Gesture Handler Component
 * Provides swipe, pan, and tap gesture recognition
 */
export function GestureHandler({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onTap,
  children,
  className = '',
}: {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTap?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [startX, setStartX] = React.useState(0);
  const [startY, setStartY] = React.useState(0);

  const handlePressIn = (e: GestureResponderEvent) => {
    setStartX(e.nativeEvent.pageX);
    setStartY(e.nativeEvent.pageY);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    const endX = e.nativeEvent.pageX;
    const endY = e.nativeEvent.pageY;
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const threshold = 50;

    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
      onTap?.();
      return;
    }

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > threshold) onSwipeRight?.();
      else if (deltaX < -threshold) onSwipeLeft?.();
    } else {
      if (deltaY > threshold) onSwipeDown?.();
      else if (deltaY < -threshold) onSwipeUp?.();
    }
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      className={cn('flex-1', className)}
    >
      {children}
    </Pressable>
  );
}

/**
 * Drawer Navigation Component
 * Slide-out navigation drawer
 */
export function DrawerNavigation({
  isOpen,
  onClose,
  items,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  items: Array<{ label: string; onPress: () => void; icon?: React.ReactNode }>;
  children: React.ReactNode;
}) {
  const drawerWidth = 250;
  const slideAnim = React.useRef(new Animated.Value(isOpen ? 0 : -drawerWidth)).current;

  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOpen ? 0 : -drawerWidth,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOpen, slideAnim, drawerWidth]);

  return (
    <View className="flex-1">
      {isOpen && (
        <Pressable
          className="absolute inset-0 z-40 bg-black/50"
          onPress={onClose}
        />
      )}
      <Animated.View
        style={{
          transform: [{ translateX: slideAnim }],
          width: drawerWidth,
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 50,
        }}
        className="bg-surface"
      >
        <ScrollView className="flex-1 p-4">
          {items.map((item, index) => (
            <Pressable
              key={index}
              onPress={() => {
                item.onPress();
                onClose();
              }}
              className="flex-row items-center gap-3 py-3 px-2 rounded-lg active:bg-background"
            >
              {item.icon && <View className="w-6 h-6">{item.icon}</View>}
              <Text className="text-foreground font-medium">{item.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>
      <View className="flex-1">{children}</View>
    </View>
  );
}

/**
 * Tab Badges Component
 * Notification badges for tab bar items
 */
export function TabBadge({
  count,
  maxCount = 99,
  className = '',
}: {
  count: number;
  maxCount?: number;
  className?: string;
}) {
  if (count === 0) return null;

  const displayCount = count > maxCount ? `${maxCount}+` : count;

  return (
    <View
      className={cn(
        'absolute -top-1 -right-1 bg-error rounded-full w-5 h-5 items-center justify-center',
        className
      )}
    >
      <Text className="text-errorForeground text-xs font-bold">{displayCount}</Text>
    </View>
  );
}

/**
 * Flash List Component
 * High-performance list for rendering large datasets
 */
export function FlashList({
  data,
  renderItem,
  keyExtractor,
  onEndReached,
  onEndReachedThreshold = 0.1,
  className = '',
}: {
  data: any[];
  renderItem: (item: any, index: number) => React.ReactNode;
  keyExtractor: (item: any, index: number) => string;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  className?: string;
}) {
  const [visibleRange, setVisibleRange] = React.useState({ start: 0, end: 10 });

  const handleScroll = (event: any) => {
    const contentOffsetY = event.nativeEvent.contentOffset.y;
    const contentHeight = event.nativeEvent.contentSize.height;
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;

    if (contentHeight - contentOffsetY - layoutHeight < contentHeight * onEndReachedThreshold) {
      onEndReached?.();
    }

    // Calculate visible range for virtualization
    const itemHeight = 100; // Approximate
    const start = Math.floor(contentOffsetY / itemHeight);
    const end = start + Math.ceil(layoutHeight / itemHeight) + 2;
    setVisibleRange({ start, end });
  };

  const visibleItems = data.slice(visibleRange.start, visibleRange.end);

  return (
    <ScrollView
      onScroll={handleScroll}
      scrollEventThrottle={16}
      className={cn('flex-1', className)}
    >
      {visibleItems.map((item, index) => (
        <View key={keyExtractor(item, visibleRange.start + index)}>
          {renderItem(item, visibleRange.start + index)}
        </View>
      ))}
    </ScrollView>
  );
}

/**
 * Back Button Handler Component
 * Manages Android back button behavior
 */
export function BackButtonHandler({
  onBackPress,
  children,
}: {
  onBackPress?: () => boolean;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    const handleBackPress = () => {
      if (onBackPress) {
        return onBackPress();
      }
      return false;
    };

    // On native Android, this would be handled by BackHandler
    // For now, we'll just provide the structure
    return () => {};
  }, [onBackPress]);

  return <View className="flex-1">{children}</View>;
}

/**
 * Optimistic Update Component
 * Shows optimistic UI changes before server confirmation
 */
export function OptimisticUpdate({
  isPending,
  children,
  fallback,
}: {
  isPending: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <View className="opacity-75">
      {isPending ? fallback || children : children}
    </View>
  );
}

/**
 * Infinite Scroll Component
 * Auto-loads more items as user scrolls to bottom
 */
export function InfiniteScroll({
  data,
  renderItem,
  onLoadMore,
  isLoading,
  hasMore,
  className = '',
}: {
  data: any[];
  renderItem: (item: any, index: number) => React.ReactNode;
  onLoadMore: () => void;
  isLoading: boolean;
  hasMore: boolean;
  className?: string;
}) {
  const handleEndReached = () => {
    if (!isLoading && hasMore) {
      onLoadMore();
    }
  };

  return (
    <ScrollView
      onScroll={(e) => {
        const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
        if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 500) {
          handleEndReached();
        }
      }}
      scrollEventThrottle={400}
      className={cn('flex-1', className)}
    >
      {data.map((item, index) => (
        <View key={index}>{renderItem(item, index)}</View>
      ))}
      {isLoading && (
        <View className="py-4 items-center">
          <Text className="text-muted">Loading more...</Text>
        </View>
      )}
      {!hasMore && data.length > 0 && (
        <View className="py-4 items-center">
          <Text className="text-muted">No more items</Text>
        </View>
      )}
    </ScrollView>
  );
}

/**
 * Focus/Blur Hooks
 * Track app focus state
 */
export function useFocusEffect(callback: () => void | (() => void)) {
  const [isFocused, setIsFocused] = React.useState(true);

  React.useEffect(() => {
    if (isFocused) {
      const cleanup = callback();
      return cleanup;
    }
  }, [isFocused, callback]);

  return { isFocused, setIsFocused };
}

/**
 * Clipboard Hook
 * Copy/paste text to clipboard
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    // In a real implementation, use react-native-clipboard or expo-clipboard
    console.log('Copied to clipboard:', text);
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
  }
}

/**
 * Share Sheet Component
 * Native share dialog
 */
export async function shareContent({
  message,
  url,
  title,
}: {
  message?: string;
  url?: string;
  title?: string;
}): Promise<void> {
  try {
    // In a real implementation, use react-native Share API
    console.log('Sharing:', { message, url, title });
  } catch (error) {
    console.error('Failed to share:', error);
  }
}
