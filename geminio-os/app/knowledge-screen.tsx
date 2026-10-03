import { ScrollView, Text, View, Pressable, TextInput, FlatList } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-context";
import * as Haptics from "expo-haptics";

export default function KnowledgeScreen() {
  const colors = useColors();
  const { notes, addNote, deleteNote } = useData();
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddNote = async () => {
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;

    addNote({
      title: newNoteTitle,
      content: newNoteContent,
      tags: [],
    });

    setNewNoteTitle("");
    setNewNoteContent("");
    setShowAddNote(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const NoteCard = ({ note }: { note: typeof notes[0] }) => (
    <Pressable
      style={({ pressed }) => [
        {
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      className="bg-surface rounded-2xl p-4 mb-3 border border-border"
    >
      <View className="gap-2">
        <Text className="text-lg font-bold text-foreground">
          {note.title}
        </Text>
        <Text className="text-sm text-muted line-clamp-2">
          {note.content}
        </Text>
        <View className="flex-row items-center justify-between pt-2 border-t border-border">
          <Text className="text-xs text-muted">
            {new Date(note.updatedAt).toLocaleDateString()}
          </Text>
          <Pressable
            onPress={() => deleteNote(note.id)}
            className="p-2"
          >
            <Text className="text-lg">🗑️</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );

  return (
    <ScreenContainer className="p-0">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="px-6 pt-6 pb-8 gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">
              Knowledge Vault
            </Text>
            <Text className="text-base text-muted">
              Store and organize your notes
            </Text>
          </View>

          {/* Search Bar */}
          <View className="bg-surface rounded-full px-4 py-3 border border-border flex-row items-center gap-2">
            <Text className="text-lg">🔍</Text>
            <TextInput
              placeholder="Search notes..."
              placeholderTextColor={colors.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 text-foreground"
            />
          </View>

          {/* Add Note Button */}
          {!showAddNote && (
            <Pressable
              onPress={() => setShowAddNote(true)}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
              className="bg-primary rounded-2xl p-4 items-center"
            >
              <Text className="text-white font-semibold">
                + Create New Note
              </Text>
            </Pressable>
          )}

          {/* Add Note Form */}
          {showAddNote && (
            <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
              <TextInput
                placeholder="Note title..."
                placeholderTextColor={colors.muted}
                value={newNoteTitle}
                onChangeText={setNewNoteTitle}
                className="bg-background border border-border rounded-lg p-3 text-foreground"
              />
              <TextInput
                placeholder="Note content..."
                placeholderTextColor={colors.muted}
                value={newNoteContent}
                onChangeText={setNewNoteContent}
                multiline
                numberOfLines={4}
                className="bg-background border border-border rounded-lg p-3 text-foreground"
              />
              <View className="flex-row gap-2">
                <Pressable
                  onPress={handleAddNote}
                  className="flex-1 bg-primary rounded-lg p-3 items-center"
                >
                  <Text className="text-white font-semibold">
                    Save Note
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setShowAddNote(false);
                    setNewNoteTitle("");
                    setNewNoteContent("");
                  }}
                  className="flex-1 bg-surface border border-border rounded-lg p-3 items-center"
                >
                  <Text className="text-foreground font-semibold">
                    Cancel
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Notes List */}
          <View className="gap-2">
            <Text className="text-lg font-bold text-foreground">
              {filteredNotes.length} Notes
            </Text>
            {filteredNotes.length > 0 ? (
              filteredNotes.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))
            ) : (
              <View className="bg-surface rounded-2xl p-6 border border-border items-center">
                <Text className="text-muted text-center">
                  {searchQuery ? "No notes found" : "No notes yet. Create one to get started!"}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
