import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, Pressable, Alert, FlatList, TextInput } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import * as Haptics from 'expo-haptics';

interface MarketplaceItem {
  id: string;
  name: string;
  type: 'template' | 'plugin' | 'agent' | 'workflow' | 'theme';
  price: number;
  rating: number;
  reviews: number;
  creator: string;
  description: string;
  downloads: number;
}

interface CommunityTeam {
  id: string;
  name: string;
  members: number;
  description: string;
  category: string;
  image: string;
}

const MARKETPLACE_ITEMS: MarketplaceItem[] = [
  {
    id: 'm1',
    name: 'E-Commerce Template',
    type: 'template',
    price: 29.99,
    rating: 4.8,
    reviews: 234,
    creator: 'TemplateStudio',
    description: 'Complete e-commerce app template',
    downloads: 1250,
  },
  {
    id: 'm2',
    name: 'AI Chat Plugin',
    type: 'plugin',
    price: 19.99,
    rating: 4.9,
    reviews: 156,
    creator: 'AITools',
    description: 'Advanced AI chatbot plugin',
    downloads: 890,
  },
  {
    id: 'm3',
    name: 'Social Media Agent',
    type: 'agent',
    price: 39.99,
    rating: 4.7,
    reviews: 98,
    creator: 'AgentLab',
    description: 'Automated social media management',
    downloads: 456,
  },
];

const COMMUNITY_TEAMS: CommunityTeam[] = [
  {
    id: 'c1',
    name: 'React Developers',
    members: 5432,
    description: 'Community for React developers',
    category: 'Development',
    image: '⚛️',
  },
  {
    id: 'c2',
    name: 'AI Enthusiasts',
    members: 3210,
    description: 'Learn and discuss AI/ML',
    category: 'Learning',
    image: '🤖',
  },
  {
    id: 'c3',
    name: 'Designers Hub',
    members: 2890,
    description: 'UI/UX design community',
    category: 'Design',
    image: '🎨',
  },
];

export default function MarketplaceCommunityScreen() {
  const [activeTab, setActiveTab] = useState<'marketplace' | 'community'>('marketplace');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'template' | 'plugin' | 'agent' | 'workflow' | 'theme'>('all');

  const handlePurchase = useCallback((itemId: string) => {
    const item = MARKETPLACE_ITEMS.find(i => i.id === itemId);
    if (!item) return;

    Alert.alert('Purchase', `Purchase "${item.name}" for $${item.price.toFixed(2)}?`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleJoinTeam = useCallback((teamId: string) => {
    const team = COMMUNITY_TEAMS.find(t => t.id === teamId);
    if (!team) return;

    Alert.alert('Join Team', `Join "${team.name}"?`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handlePublishItem = useCallback(() => {
    Alert.alert('Publish', 'Share your creation with the community');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const filteredItems = MARKETPLACE_ITEMS.filter(item =>
    (filterType === 'all' || item.type === filterType) &&
    (item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.creator.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const MarketplaceCard = ({ item }: { item: MarketplaceItem }) => (
    <Pressable
      onPress={() => handlePurchase(item.id)}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      className="bg-surface rounded-2xl p-4 mb-3 border border-border"
    >
      <View className="gap-2">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground">{item.name}</Text>
            <Text className="text-xs text-primary mt-1 uppercase">{item.type}</Text>
            <Text className="text-xs text-muted mt-1">by {item.creator}</Text>
          </View>
          <Text className="text-xl font-bold text-primary">${item.price.toFixed(2)}</Text>
        </View>
        <Text className="text-sm text-muted">{item.description}</Text>
        <View className="flex-row items-center gap-4 mt-2">
          <View className="flex-row items-center gap-1">
            <Text className="text-warningText">⭐</Text>
            <Text className="text-xs font-semibold text-foreground">{item.rating}</Text>
            <Text className="text-xs text-muted">({item.reviews})</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Text className="text-xs">📥</Text>
            <Text className="text-xs text-muted">{item.downloads} downloads</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );

  const CommunityCard = ({ team }: { team: CommunityTeam }) => (
    <Pressable
      onPress={() => handleJoinTeam(team.id)}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      className="bg-surface rounded-2xl p-4 mb-3 border border-border"
    >
      <View className="gap-3">
        <View className="flex-row items-center gap-3">
          <Text className="text-4xl">{team.image}</Text>
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground">{team.name}</Text>
            <Text className="text-xs text-primary">{team.category}</Text>
            <Text className="text-xs text-muted mt-1">{team.members} members</Text>
          </View>
        </View>
        <Text className="text-sm text-muted">{team.description}</Text>
        <Pressable
          onPress={() => handleJoinTeam(team.id)}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          className="bg-primary rounded-lg py-2 items-center"
        >
          <Text className="text-primaryForeground font-semibold">Join Team</Text>
        </Pressable>
      </View>
    </Pressable>
  );

  return (
    <ScreenContainer className="p-0">
      <View className="flex-1">
        {/* Tabs */}
        <View className="flex-row border-b border-border">
          <Pressable
            onPress={() => setActiveTab('marketplace')}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            className={`flex-1 py-4 items-center border-b-2 ${
              activeTab === 'marketplace' ? 'border-primary' : 'border-transparent'
            }`}
          >
            <Text className={`font-semibold ${activeTab === 'marketplace' ? 'text-primary' : 'text-muted'}`}>
              Marketplace
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('community')}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            className={`flex-1 py-4 items-center border-b-2 ${
              activeTab === 'community' ? 'border-primary' : 'border-transparent'
            }`}
          >
            <Text className={`font-semibold ${activeTab === 'community' ? 'text-primary' : 'text-muted'}`}>
              Community
            </Text>
          </Pressable>
        </View>

        {/* Content */}
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
          <View className="px-6 pt-6 pb-8 gap-4">
            {activeTab === 'marketplace' ? (
              <>
                {/* Search */}
                <TextInput
                  placeholder="Search marketplace..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  className="bg-surface border border-border rounded-lg p-3 text-foreground"
                  placeholderTextColor="#999"
                />

                {/* Filters */}
                <View className="flex-row flex-wrap gap-2">
                  {(['all', 'template', 'plugin', 'agent', 'workflow', 'theme'] as const).map(type => (
                    <Pressable
                      key={type}
                      onPress={() => setFilterType(type)}
                      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                      className={`rounded-lg py-2 px-3 border ${
                        filterType === type ? 'bg-primary border-primary' : 'bg-surface border-border'
                      }`}
                    >
                      <Text className={`text-xs font-semibold ${filterType === type ? 'text-primaryForeground' : 'text-foreground'}`}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Items */}
                <View className="gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-lg font-bold text-foreground">
                      Items ({filteredItems.length})
                    </Text>
                    <Pressable
                      onPress={handlePublishItem}
                      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                      className="bg-primary rounded-lg px-3 py-1"
                    >
                      <Text className="text-primaryForeground font-semibold text-sm">Publish</Text>
                    </Pressable>
                  </View>
                  {filteredItems.map(item => (
                    <MarketplaceCard key={item.id} item={item} />
                  ))}
                </View>
              </>
            ) : (
              <>
                {/* Community Teams */}
                <View className="gap-2">
                  <Text className="text-lg font-bold text-foreground">Join Communities</Text>
                  {COMMUNITY_TEAMS.map(team => (
                    <CommunityCard key={team.id} team={team} />
                  ))}
                </View>

                {/* Create Team */}
                <Pressable
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                  className="bg-primary rounded-lg p-4 items-center"
                >
                  <Text className="text-primaryForeground font-semibold">+ Create New Team</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}
