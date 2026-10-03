import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            <View style={{ alignItems: 'center', gap: 16 }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#000000' }}>
                Oops! Something went wrong
              </Text>
              <Text style={{ fontSize: 16, color: '#666666', textAlign: 'center', marginVertical: 8 }}>
                {this.state.error?.message || 'An unexpected error occurred'}
              </Text>
              {__DEV__ && this.state.errorInfo && (
                <Text style={{ fontSize: 12, color: '#999999', textAlign: 'left', fontFamily: 'monospace', marginVertical: 8 }}>
                  {this.state.errorInfo.componentStack}
                </Text>
              )}
              <Pressable
                onPress={this.handleReset}
                style={{ backgroundColor: '#007AFF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 16 }}
              >
                <Text style={{ color: '#ffffff', fontWeight: '600', textAlign: 'center' }}>
                  Try Again
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
