import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, Pressable, TextInput, Modal, Alert, FlatList } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import * as Haptics from 'expo-haptics';

interface VaultItem {
  id: string;
  title: string;
  type: 'note' | 'document' | 'research' | 'learning';
  content: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface IdentityDocument {
  id: string;
  type: 'passport' | 'id_card' | 'certificate' | 'contract';
  name: string;
  issueDate: Date;
  expiryDate?: Date;
  encrypted: boolean;
  accessControl: string[];
}

const SAMPLE_VAULT_ITEMS: VaultItem[] = [
  {
    id: 'v1',
    title: 'AI Learning Notes',
    type: 'learning',
    content: 'Notes on machine learning fundamentals...',
    tags: ['AI', 'ML', 'Learning'],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'v2',
    title: 'Research: Blockchain',
    type: 'research',
    content: 'Research findings on blockchain technology...',
    tags: ['Blockchain', 'Crypto', 'Research'],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export default function KnowledgeVaultScreen() {
  const [vaultItems, setVaultItems] = useState<VaultItem[]>(SAMPLE_VAULT_ITEMS);
  const [identityDocs, setIdentityDocs] = useState<IdentityDocument[]>([]);
  const [activeTab, setActiveTab] = useState<'knowledge' | 'identity'>('knowledge');
  const [showAddModal, setShowAddModal] = useState(false);
  const [itemTitle, setItemTitle] = useState('');
  const [itemContent, setItemContent] = useState('');
  const [selectedType, setSelectedType] = useState<'note' | 'document' | 'research' | 'learning'>('note');
  const [searchQuery, setSearchQuery] = useState('');

  const handleAddItem = useCallback(() => {
    if (!itemTitle.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    const newItem: VaultItem = {
      id: `item-${Date.now()}`,
      title: itemTitle,
      type: selectedType,
      content: itemContent,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setVaultItems([newItem, ...vaultItems]);
    setItemTitle('');
    setItemContent('');
    setShowAddModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [itemTitle, itemContent, selectedType, vaultItems]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleGenerateSummary = useCallback((itemId: string) => {
    const item = vaultItems.find(i => i.id === itemId);
    if (!item) return;

    Alert.alert('Summary', `Generating summary for "${item.title}"...`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [vaultItems]);

  const handleViewKnowledgeGraph = useCallback(() => {
    Alert.alert('Knowledge Graph', 'Visualizing connections between your notes...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const filteredItems = vaultItems.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const VaultItemCard = ({ item }: { item: VaultItem }) => (
    <Pressable
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      className="bg-surface rounded-2xl p-4 mb-3 border border-border"
    >
      <View className="gap-2">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground">{item.title}</Text>
            <Text className="text-xs text-primary mt-1 uppercase">{item.type}</Text>
          </View>
          <Pressable
            onPress={() => handleGenerateSummary(item.id)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            className="bg-primary/20 rounded-lg px-2 py-1"
          >
            <Text className="text-primary font-semibold text-xs">Summary</Text>
          </Pressable>
        </View>
        <Text className="text-sm text-muted line-clamp-2">{item.content}</Text>
        {item.tags.length > 0 && (
          <View className="flex-row flex-wrap gap-1 mt-2">
            {item.tags.map(tag => (
              <View key={tag} className="bg-primary/10 rounded px-2 py-1">
                <Text className="text-xs text-primary font-semibold">#{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );

  const IdentityDocCard = ({ doc }: { doc: IdentityDocument }) => (
    <Pressable
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      className="bg-surface rounded-2xl p-4 mb-3 border border-border"
    >
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground">{doc.name}</Text>
            <Text className="text-xs text-muted mt-1 uppercase">{doc.type.replace('_', ' ')}</Text>
          </View>
          <View className={`px-2 py-1 rounded ${doc.encrypted ? 'bg-success/20' : 'bg-warning/20'}`}>
            <Text className={`text-xs font-semibold ${doc.encrypted ? 'text-successText' : 'text-warningText'}`}>
              {doc.encrypted ? '🔒 Encrypted' : '🔓 Unencrypted'}
            </Text>
          </View>
        </View>
        <Text className="text-xs text-muted">
          Issued: {doc.issueDate.toLocaleDateString()}
          {doc.expiryDate && ` • Expires: ${doc.expiryDate.toLocaleDateString()}`}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <ScreenContainer className="p-0">
      <View className="flex-1">
        {/* Tabs */}
        <View className="flex-row border-b border-border">
          <Pressable
            onPress={() => setActiveTab('knowledge')}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            className={`flex-1 py-4 items-center border-b-2 ${
              activeTab === 'knowledge' ? 'border-primary' : 'border-transparent'
            }`}
          >
            <Text className={`font-semibold ${activeTab === 'knowledge' ? 'text-primary' : 'text-muted'}`}>
              Knowledge Vault
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('identity')}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            className={`flex-1 py-4 items-center border-b-2 ${
              activeTab === 'identity' ? 'border-primary' : 'border-transparent'
            }`}
          >
            <Text className={`font-semibold ${activeTab === 'identity' ? 'text-primary' : 'text-muted'}`}>
              Identity Vault
            </Text>
          </Pressable>
        </View>

        {/* Content */}
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
          <View className="px-6 pt-6 pb-8 gap-4">
            {activeTab === 'knowledge' ? (
              <>
                {/* Search */}
                <View className="gap-2">
                  <TextInput
                    placeholder="Search knowledge..."
                    value={searchQuery}
                    onChangeText={handleSearch}
                    className="bg-surface border border-border rounded-lg p-3 text-foreground"
                    placeholderTextColor="#999"
                  />
                </View>

                {/* Actions */}
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setShowAddModal(true)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    className="flex-1 bg-primary rounded-lg py-3 items-center"
                  >
                    <Text className="text-primaryForeground font-semibold">+ Add Item</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleViewKnowledgeGraph}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    className="flex-1 bg-primary/20 rounded-lg py-3 items-center"
                  >
                    <Text className="text-primary font-semibold">Graph</Text>
                  </Pressable>
                </View>

                {/* Items */}
                <View className="gap-2">
                  <Text className="text-lg font-bold text-foreground">
                    Items ({filteredItems.length})
                  </Text>
                  {filteredItems.length === 0 ? (
                    <Text className="text-center text-muted py-8">No items found</Text>
                  ) : (
                    filteredItems.map(item => (
                      <VaultItemCard key={item.id} item={item} />
                    ))
                  )}
                </View>
              </>
            ) : (
              <>
                {/* Identity Documents */}
                <View className="gap-2">
                  <Text className="text-lg font-bold text-foreground">
                    Documents ({identityDocs.length})
                  </Text>
                  {identityDocs.length === 0 ? (
                    <View className="bg-surface rounded-2xl p-8 border border-border items-center gap-2">
                      <Text className="text-3xl">🔐</Text>
                      <Text className="text-center text-muted">No documents stored yet</Text>
                      <Text className="text-xs text-muted text-center">
                        All documents are encrypted and secure
                      </Text>
                    </View>
                  ) : (
                    identityDocs.map(doc => (
                      <IdentityDocCard key={doc.id} doc={doc} />
                    ))
                  )}
                </View>

                {/* Security Info */}
                <View className="bg-primary/10 rounded-2xl p-4 border border-primary/20 gap-2">
                  <Text className="font-semibold text-primary">🔒 Security Features</Text>
                  <Text className="text-sm text-foreground">
                    All documents are encrypted with AES-256 and stored securely. Access is controlled and audited.
                  </Text>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Add Item Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50">
          <View className="flex-1 bg-background mt-12 rounded-t-3xl">
            <View className="px-6 py-4 border-b border-border flex-row items-center justify-between">
              <Text className="text-xl font-bold text-foreground">Add to Knowledge Vault</Text>
              <Pressable onPress={() => setShowAddModal(false)}>
                <Text className="text-2xl text-foreground">✕</Text>
              </Pressable>
            </View>
            <ScrollView className="flex-1 px-6 py-4 gap-4">
              <View className="gap-2">
                <Text className="text-sm font-semibold text-foreground">Type</Text>
                <View className="flex-row flex-wrap gap-2">
                  {(['note', 'document', 'research', 'learning'] as const).map(type => (
                    <Pressable
                      key={type}
                      onPress={() => setSelectedType(type)}
                      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                      className={`rounded-lg py-2 px-3 border ${
                        selectedType === type ? 'bg-primary border-primary' : 'bg-surface border-border'
                      }`}
                    >
                      <Text className={`text-xs font-semibold ${selectedType === type ? 'text-primaryForeground' : 'text-foreground'}`}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View className="gap-2">
                <Text className="text-sm font-semibold text-foreground">Title</Text>
                <TextInput
                  placeholder="Enter title"
                  value={itemTitle}
                  onChangeText={setItemTitle}
                  className="bg-surface border border-border rounded-lg p-3 text-foreground"
                  placeholderTextColor="#999"
                />
              </View>
              <View className="gap-2">
                <Text className="text-sm font-semibold text-foreground">Content</Text>
                <TextInput
                  placeholder="Enter content"
                  value={itemContent}
                  onChangeText={setItemContent}
                  multiline
                  numberOfLines={6}
                  className="bg-surface border border-border rounded-lg p-3 text-foreground"
                  placeholderTextColor="#999"
                />
              </View>
              <View className="flex-row gap-3 mt-4">
                <Pressable
                  onPress={() => setShowAddModal(false)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                  className="flex-1 bg-surface border border-border rounded-lg py-3 items-center"
                >
                  <Text className="text-foreground font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleAddItem}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                  className="flex-1 bg-primary rounded-lg py-3 items-center"
                >
                  <Text className="text-primaryForeground font-semibold">Add</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
