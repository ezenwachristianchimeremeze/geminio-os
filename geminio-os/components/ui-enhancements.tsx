import React, { useState, useCallback } from 'react';
import { View, Text, Animated, PanResponder, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import Reanimated, { FadeIn, FadeOut, SlideInDown, ZoomIn } from 'react-native-reanimated';
import { cn } from '@/lib/utils';

/**
 * Shared Element Transition Component
 * Animates a card expanding into a detail screen with smooth transitions
 */
export function SharedElementTransition({
  children,
  onPress,
  isExpanded = false,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  isExpanded?: boolean;
}) {
  return (
    <Reanimated.View
      entering={isExpanded ? ZoomIn : FadeIn}
      exiting={isExpanded ? FadeOut : undefined}
      style={{
        transform: [{ scale: isExpanded ? 1 : 0.95 }],
      }}
    >
      <Pressable onPress={onPress}>
        {children}
      </Pressable>
    </Reanimated.View>
  );
}

/**
 * Skeleton Loader Component
 * Shows animated placeholder shapes while data loads
 */
export function SkeletonLoader({
  widthValue = 100,
  height = 16,
  count = 3,
  borderRadius = 8,
  className = '',
}: {
  widthValue?: number;
  height?: number;
  count?: number;
  borderRadius?: number;
  className?: string
}) {
  const shimmerAnimation = new Animated.Value(0);

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [shimmerAnimation]);

  const opacity = shimmerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View className={cn('gap-2', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Animated.View
          key={i}
          style={{
            width: widthValue,
            height,
            borderRadius,
            opacity,
            backgroundColor: '#e5e7eb',
          }}
        />
      ))}
    </View>
  );
}

/**
 * Bottom Sheet Component
 * Draggable panel that slides up from the bottom
 */
export function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  heightValue = 300,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  heightValue?: number
}) {
  const translateY = React.useRef(new Animated.Value(0)).current;
  const [panResponder] = React.useState(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 100) {
          onClose();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  );

  if (!isOpen) return null;

  return (
    <View className="absolute inset-0 bg-black/50 z-50">
      <Animated.View
        {...panResponder.panHandlers}
        style={{
          transform: [{ translateY }],
          height: heightValue,
        }}
        className="absolute bottom-0 left-0 right-0 bg-background rounded-t-3xl"
      >
        <View className="flex-1 p-4">
          {title && (
            <Text className="text-xl font-bold text-foreground mb-4">
              {title}
            </Text>
          )}
          <ScrollView className="flex-1">
            {children}
          </ScrollView>
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * Masonry Layout Component
 * Pinterest-style variable-height grid layouts
 */
export function MasonryLayout({
  data,
  renderItem,
  numColumns = 2,
  gap = 12,
  className = '',
}: {
  data: any[];
  renderItem: (item: any, index: number) => React.ReactNode;
  numColumns?: number;
  gap?: number;
  className?: string;
}) {
  const columns: any[][] = Array.from({ length: numColumns }, () => []);

  data.forEach((item, index) => {
    columns[index % numColumns].push(item);
  });

  return (
    <View className={cn('flex-row gap-3', className)}>
      {columns.map((column, colIndex) => (
        <View key={colIndex} className="flex-1 gap-3">
          {column.map((item, itemIndex) =>
            renderItem(item, colIndex * Math.ceil(data.length / numColumns) + itemIndex)
          )}
        </View>
      ))}
    </View>
  );
}

/**
 * Parallax Scroll Component
 * Background images scroll slower than foreground content for depth
 */
export function ParallaxScroll({
  backgroundImage,
  children,
  parallaxFactor = 0.5,
}: {
  backgroundImage?: React.ReactNode;
  children: React.ReactNode;
  parallaxFactor?: number;
}) {
  const scrollY = React.useRef(new Animated.Value(0)).current;

  const backgroundTranslate = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [0, 200 * parallaxFactor],
    extrapolate: 'clamp',
  });

  return (
    <View className="flex-1">
      <Animated.View
        style={{
          transform: [{ translateY: backgroundTranslate }],
        }}
        className="absolute inset-0"
      >
        {backgroundImage}
      </Animated.View>
      <Animated.ScrollView
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
      >
        {children}
      </Animated.ScrollView>
    </View>
  );
}

/**
 * Confetti / Particle Effects Component
 * Celebration animations for success states
 */
export function ConfettiEffect({
  isActive = false,
  duration = 2000,
}: {
  isActive?: boolean;
  duration?: number;
}) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([]);

  React.useEffect(() => {
    if (isActive) {
      const newParticles = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 200,
      }));
      setParticles(newParticles);

      const timer = setTimeout(() => setParticles([]), duration);
      return () => clearTimeout(timer);
    }
  }, [isActive, duration]);

  return (
    <View className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((particle) => (
        <Reanimated.View
          key={particle.id}
          entering={FadeIn.delay(particle.delay)}
          exiting={FadeOut}
          style={{
            position: 'absolute',
            left: `${particle.x}%`,
            top: `${particle.y}%`,
          }}
          className="w-2 h-2 bg-primary rounded-full"
        />
      ))}
    </View>
  );
}

/**
 * Keyboard Avoidance Wrapper
 * Form fields slide up when the keyboard appears
 */
export function KeyboardAvoidanceView({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);
  const translateY = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const keyboardDidShow = (event: any) => {
      setKeyboardHeight(event.endCoordinates.height);
      Animated.timing(translateY, {
        toValue: -event.endCoordinates.height,
        duration: 250,
        useNativeDriver: true,
      }).start();
    };

    const keyboardDidHide = () => {
      setKeyboardHeight(0);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    };

    // Note: In a real implementation, use Keyboard.addListener for React Native
    return () => {
      // Cleanup listeners
    };
  }, [translateY]);

  return (
    <Animated.View
      style={{
        transform: [{ translateY }],
      }}
      className={cn('flex-1', className)}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Blur View Component
 * Native blur effect behind modals and overlays
 */
export function BlurView({
  intensity = 90,
  children,
  className = '',
}: {
  intensity?: number;
  children: React.ReactNode;
  className?: string;
}) {
  // Note: In a real implementation, use expo-blur
  return (
    <View
      className={cn('overflow-hidden', className)}
      style={{
        opacity: intensity / 100,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
      }}
    >
      {children}
    </View>
  );
}

/**
 * Linear Gradient Component
 * Smooth color gradients on any view or background
 */
export function LinearGradient({
  colors = ['#0a7ea4', '#ffffff'],
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
  children,
  className = '',
}: {
  colors?: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  children?: React.ReactNode;
  className?: string;
}) {
  // Note: In a real implementation, use expo-linear-gradient
  const gradientStyle = {
    background: `linear-gradient(to right, ${colors.join(', ')})`,
  };

  return (
    <View className={cn('overflow-hidden', className)} style={gradientStyle as any}>
      {children}
    </View>
  );
}

/**
 * Lottie Animation Component
 * Play complex After Effects animations as lightweight JSON files
 */
export function LottieAnimation({
  source,
  autoPlay = true,
  loop = true,
  className = '',
}: {
  source: any;
  autoPlay?: boolean;
  loop?: boolean;
  className?: string;
}) {
  // Note: In a real implementation, use lottie-react-native
  return (
    <View className={cn('w-full h-32 items-center justify-center bg-surface rounded-lg', className)}>
      <ActivityIndicator size="large" color="#0a7ea4" />
      <Text className="text-sm text-muted mt-2">Animation</Text>
    </View>
  );
}

/**
 * Tab Badge Component
 * Show notification counts on tab bar icons
 */
export function TabBadge({
  count,
  children,
}: {
  count?: number;
  children: React.ReactNode;
}) {
  if (!count || count === 0) {
    return <>{children}</>;
  }

  return (
    <View className="relative">
      {children}
      <View className="absolute -top-1 -right-1 bg-error rounded-full w-5 h-5 items-center justify-center">
        <Text className="text-xs font-bold text-background">
          {count > 99 ? '99+' : count}
        </Text>
      </View>
    </View>
  );
}
