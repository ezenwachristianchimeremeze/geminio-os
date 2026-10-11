import { ScrollView, Text, View, Pressable, TextInput, Modal, FlatList } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useMemory } from "@/lib/memory-context";
import * as Haptics from "expo-haptics";

interface KnowledgeNode {
  id: string;
  title: string;
  content: string;
  tags: string[];
  connections: string[];
  createdAt: Date;
}

export default function KnowledgeGraphScreen() {
  const colors = useColors();
  const { addMemory } = useMemory();
  const [nodes, setNodes] = useState<KnowledgeNode[]>([
    {
      id: "1",
      title: "React Native",
      content: "JavaScript framework for building mobile apps",
      tags: ["programming", "mobile", "javascript"],
      connections: ["2", "3"],
      createdAt: new Date(),
    },
    {
      id: "2",
      title: "Expo",
      content: "Framework and platform for universal React applications",
      tags: ["programming", "mobile", "react"],
      connections: ["1"],
      createdAt: new Date(),
    },
    {
      id: "3",
      title: "TypeScript",
      content: "Typed superset of JavaScript",
      tags: ["programming", "javascript"],
      connections: ["1"],
      createdAt: new Date(),
    },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [newNode, setNewNode] = useState({
    title: "",
    content: "",
    tags: "",
  });

  const addNode = async () => {
    if (!newNode.title.trim()) return;

    const node: KnowledgeNode = {
      id: Date.now().toString(),
      title: newNode.title,
      content: newNode.content,
      tags: newNode.tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t),
      connections: [],
      createdAt: new Date(),
    };

    setNodes((prev) => [node, ...prev]);
    await addMemory({
      type: "note",
      content: newNode.title,
      tags: node.tags,
    });

    setNewNode({ title: "", content: "", tags: "" });
    setShowModal(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const connectNodes = async (fromId: string, toId: string) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === fromId && !n.connections.includes(toId)
          ? { ...n, connections: [...n.connections, toId] }
          : n
      )
    );
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const deleteNode = async (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const NodeCard = ({ node }: { node: KnowledgeNode }) => (
    <Pressable
      onPress={() => setSelectedNode(node)}
      className="bg-surface border border-border rounded-lg p-4 mb-3"
    >
      <View className="flex-row items-start justify-between mb-2">
        <Text className="font-semibold text-foreground flex-1">{node.title}</Text>
        <View className="bg-primary/20 px-2 py-1 rounded-full">
          <Text className="text-xs text-primary font-semibold">{node.connections.length}</Text>
        </View>
      </View>
      <Text className="text-sm text-muted mb-3">{node.content}</Text>
      <View className="flex-row flex-wrap gap-2">
        {node.tags.map((tag, idx) => (
          <View key={idx} className="bg-primary/10 px-2 py-1 rounded-full">
            <Text className="text-xs text-primary">{tag}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );

  return (
    <ScreenContainer className="p-0 flex-1">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-6 pt-6 pb-4 border-b border-border">
          <Text className="text-2xl font-bold text-foreground">Knowledge Graph</Text>
          <Text className="text-sm text-muted mt-1">
            {nodes.length} connected knowledge nodes
          </Text>
        </View>

        {/* Graph Stats */}
        <View className="px-6 pt-6 pb-6">
          <View className="flex-row gap-3">
            <View className="flex-1 bg-surface border border-border rounded-lg p-4 items-center">
              <Text className="text-3xl font-bold text-primary">{nodes.length}</Text>
              <Text className="text-xs text-muted mt-1">Total Nodes</Text>
            </View>
            <View className="flex-1 bg-surface border border-border rounded-lg p-4 items-center">
              <Text className="text-3xl font-bold text-primary">
                {nodes.reduce((sum, n) => sum + n.connections.length, 0)}
              </Text>
              <Text className="text-xs text-muted mt-1">Connections</Text>
            </View>
            <View className="flex-1 bg-surface border border-border rounded-lg p-4 items-center">
              <Text className="text-3xl font-bold text-primary">
                {new Set(nodes.flatMap((n) => n.tags)).size}
              </Text>
              <Text className="text-xs text-muted mt-1">Unique Tags</Text>
            </View>
          </View>
        </View>

        {/* Knowledge Nodes */}
        <View className="px-6 pb-6">
          <Text className="text-lg font-semibold text-foreground mb-4">Your Knowledge</Text>
          {nodes.length === 0 ? (
            <View className="items-center justify-center py-8">
              <Text className="text-4xl mb-3">🧠</Text>
              <Text className="text-lg font-semibold text-foreground">No knowledge nodes yet</Text>
              <Text className="text-sm text-muted mt-1">Create your first knowledge node</Text>
            </View>
          ) : (
            nodes.map((node) => <NodeCard key={node.id} node={node} />)
          )}
        </View>
      </ScrollView>

      {/* Add Node Button */}
      <View className="px-6 pb-6">
        <Pressable
          onPress={() => setShowModal(true)}
          style={({ pressed }) => [
            {
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            },
          ]}
          className="bg-primary rounded-lg p-4 items-center justify-center"
        >
          <Text className="text-primaryForeground font-semibold text-lg">+ Add Knowledge Node</Text>
        </Pressable>
      </View>

      {/* Add Node Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-foreground">New Knowledge Node</Text>
              <Pressable onPress={() => setShowModal(false)}>
                <Text className="text-2xl text-muted">✕</Text>
              </Pressable>
            </View>

            <ScrollView className="mb-6">
              <Text className="text-sm font-semibold text-foreground mb-2">Title</Text>
              <TextInput
                placeholder="What is this knowledge about?"
                placeholderTextColor={colors.muted}
                value={newNode.title}
                onChangeText={(text) =>
                  setNewNode((prev) => ({ ...prev, title: text }))
                }
                className="w-full bg-surface border border-border rounded-lg p-3 text-foreground mb-4"
              />

              <Text className="text-sm font-semibold text-foreground mb-2">Content</Text>
              <TextInput
                placeholder="Describe this knowledge..."
                placeholderTextColor={colors.muted}
                value={newNode.content}
                onChangeText={(text) =>
                  setNewNode((prev) => ({ ...prev, content: text }))
                }
                multiline
                numberOfLines={4}
                className="w-full bg-surface border border-border rounded-lg p-3 text-foreground mb-4"
              />

              <Text className="text-sm font-semibold text-foreground mb-2">Tags (comma-separated)</Text>
              <TextInput
                placeholder="e.g., programming, javascript, react"
                placeholderTextColor={colors.muted}
                value={newNode.tags}
                onChangeText={(text) =>
                  setNewNode((prev) => ({ ...prev, tags: text }))
                }
                className="w-full bg-surface border border-border rounded-lg p-3 text-foreground mb-4"
              />
            </ScrollView>

            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setShowModal(false)}
                className="flex-1 bg-surface border border-border rounded-lg p-3 items-center"
              >
                <Text className="text-foreground font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={addNode}
                disabled={!newNode.title.trim()}
                className="flex-1 bg-primary rounded-lg p-3 items-center"
              >
                <Text className="text-primaryForeground font-semibold">Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Node Detail Modal */}
      <Modal visible={!!selectedNode} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-6 max-h-[80%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-foreground flex-1">
                {selectedNode?.title}
              </Text>
              <Pressable onPress={() => setSelectedNode(null)}>
                <Text className="text-2xl text-muted">✕</Text>
              </Pressable>
            </View>

            <ScrollView className="flex-1 mb-4">
              <Text className="text-foreground leading-relaxed mb-4">{selectedNode?.content}</Text>

              {selectedNode?.tags && selectedNode.tags.length > 0 && (
                <View className="mb-4">
                  <Text className="text-sm font-semibold text-foreground mb-2">Tags</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {selectedNode.tags.map((tag, idx) => (
                      <View key={idx} className="bg-primary/10 px-3 py-1 rounded-full">
                        <Text className="text-sm text-primary">{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {selectedNode?.connections && selectedNode.connections.length > 0 && (
                <View className="mt-4 pt-4 border-t border-border">
                  <Text className="text-sm font-semibold text-foreground mb-2">Connected Nodes</Text>
                  {selectedNode.connections.map((connId) => {
                    const connNode = nodes.find((n) => n.id === connId);
                    return (
                      <View key={connId} className="bg-surface border border-border rounded-lg p-3 mb-2">
                        <Text className="font-semibold text-foreground">{connNode?.title}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setSelectedNode(null)}
                className="flex-1 bg-surface border border-border rounded-lg p-3 items-center"
              >
                <Text className="text-foreground font-semibold">Close</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (selectedNode) deleteNode(selectedNode.id);
                  setSelectedNode(null);
                }}
                className="flex-1 bg-error/10 border border-error/30 rounded-lg p-3 items-center"
              >
                <Text className="text-errorText font-semibold">Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
