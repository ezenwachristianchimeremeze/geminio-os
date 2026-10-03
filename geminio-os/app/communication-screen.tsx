import { ScrollView, Text, View, Pressable, TextInput } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";

interface Contact {
  id: string;
  name: string;
  email: string;
  lastContact: number;
  category: string;
}

interface Message {
  id: string;
  title: string;
  preview: string;
  status: 'draft' | 'sent' | 'scheduled';
  date: number;
}

export default function CommunicationScreen() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<'contacts' | 'messages' | 'calendar'>('contacts');
  const [contacts, setContacts] = useState<Contact[]>([
    {
      id: '1',
      name: 'John Smith',
      email: 'john@example.com',
      lastContact: Date.now() - 86400000,
      category: 'Business',
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      email: 'sarah@example.com',
      lastContact: Date.now() - 604800000,
      category: 'Colleague',
    },
  ]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      title: 'Project Update Email',
      preview: 'Hi team, here\'s the latest update on the project...',
      status: 'draft',
      date: Date.now(),
    },
    {
      id: '2',
      title: 'Meeting Confirmation',
      preview: 'Thank you for scheduling the meeting. I confirm...',
      status: 'sent',
      date: Date.now() - 86400000,
    },
  ]);

  const ContactCard = ({ contact }: { contact: Contact }) => (
    <Pressable
      style={({ pressed }) => [
        {
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      className="bg-surface rounded-2xl p-4 mb-3 border border-border flex-row items-center justify-between"
    >
      <View className="flex-row items-center gap-3 flex-1">
        <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center">
          <Text className="text-lg">👤</Text>
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-foreground">
            {contact.name}
          </Text>
          <Text className="text-xs text-muted mt-1">
            {contact.email}
          </Text>
        </View>
      </View>
      <View className="bg-primary/10 rounded-full px-2 py-1">
        <Text className="text-xs font-semibold text-primary">
          {contact.category}
        </Text>
      </View>
    </Pressable>
  );

  const MessageCard = ({ message }: { message: Message }) => (
    <Pressable
      style={({ pressed }) => [
        {
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      className="bg-surface rounded-2xl p-4 mb-3 border border-border"
    >
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-bold text-foreground flex-1">
            {message.title}
          </Text>
          <View
            className={`px-2 py-1 rounded-full ${
              message.status === 'draft'
                ? 'bg-warning/20'
                : message.status === 'sent'
                  ? 'bg-success/20'
                  : 'bg-primary/20'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                message.status === 'draft'
                  ? 'text-warning'
                  : message.status === 'sent'
                    ? 'text-success'
                    : 'text-primary'
              }`}
            >
              {message.status}
            </Text>
          </View>
        </View>
        <Text className="text-sm text-muted line-clamp-2">
          {message.preview}
        </Text>
        <Text className="text-xs text-muted pt-2 border-t border-border">
          {new Date(message.date).toLocaleDateString()}
        </Text>
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
              Communication Center
            </Text>
            <Text className="text-base text-muted">
              Manage contacts and messages
            </Text>
          </View>

          {/* Tab Navigation */}
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setActiveTab('contacts')}
              className={`flex-1 py-2 px-3 rounded-lg border ${
                activeTab === 'contacts'
                  ? 'bg-primary border-primary'
                  : 'border-border bg-surface'
              }`}
            >
              <Text
                className={`text-center font-semibold text-sm ${
                  activeTab === 'contacts'
                    ? 'text-white'
                    : 'text-foreground'
                }`}
              >
                Contacts
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('messages')}
              className={`flex-1 py-2 px-3 rounded-lg border ${
                activeTab === 'messages'
                  ? 'bg-primary border-primary'
                  : 'border-border bg-surface'
              }`}
            >
              <Text
                className={`text-center font-semibold text-sm ${
                  activeTab === 'messages'
                    ? 'text-white'
                    : 'text-foreground'
                }`}
              >
                Messages
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('calendar')}
              className={`flex-1 py-2 px-3 rounded-lg border ${
                activeTab === 'calendar'
                  ? 'bg-primary border-primary'
                  : 'border-border bg-surface'
              }`}
            >
              <Text
                className={`text-center font-semibold text-sm ${
                  activeTab === 'calendar'
                    ? 'text-white'
                    : 'text-foreground'
                }`}
              >
                Calendar
              </Text>
            </Pressable>
          </View>

          {/* Content */}
          {activeTab === 'contacts' && (
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-bold text-foreground">
                  Contacts
                </Text>
                <Text className="text-sm text-muted">
                  {contacts.length} total
                </Text>
              </View>
              {contacts.map((contact) => (
                <ContactCard key={contact.id} contact={contact} />
              ))}
              <Pressable
                style={({ pressed }) => [
                  {
                    opacity: pressed ? 0.7 : 1,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
                className="bg-primary rounded-2xl p-4 items-center mt-2"
              >
                <Text className="text-white font-semibold">
                  + Add Contact
                </Text>
              </Pressable>
            </View>
          )}

          {activeTab === 'messages' && (
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-bold text-foreground">
                  Messages
                </Text>
                <Text className="text-sm text-muted">
                  {messages.length} total
                </Text>
              </View>
              {messages.map((message) => (
                <MessageCard key={message.id} message={message} />
              ))}
              <Pressable
                style={({ pressed }) => [
                  {
                    opacity: pressed ? 0.7 : 1,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
                className="bg-primary rounded-2xl p-4 items-center mt-2"
              >
                <Text className="text-white font-semibold">
                  + Compose Message
                </Text>
              </Pressable>
            </View>
          )}

          {activeTab === 'calendar' && (
            <View className="bg-surface rounded-2xl p-6 border border-border gap-4">
              <Text className="text-lg font-bold text-foreground text-center">
                📅 Calendar Integration
              </Text>
              <Text className="text-sm text-muted text-center">
                Sync your calendar events and schedule meetings
              </Text>
              <Pressable
                style={({ pressed }) => [
                  {
                    opacity: pressed ? 0.7 : 1,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
                className="bg-primary rounded-lg p-3 items-center mt-2"
              >
                <Text className="text-white font-semibold">
                  Connect Calendar
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
