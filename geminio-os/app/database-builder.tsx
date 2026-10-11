import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, Pressable, TextInput, Modal, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import * as Haptics from 'expo-haptics';

interface Database {
  id: string;
  name: string;
  type: 'postgresql' | 'mysql' | 'mongodb' | 'sqlite';
  tables: DatabaseTable[];
  createdAt: Date;
}

interface DatabaseTable {
  id: string;
  name: string;
  columns: TableColumn[];
  indexes: TableIndex[];
  primaryKey: string;
}

interface TableColumn {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'json' | 'text' | 'uuid';
  nullable: boolean;
  unique: boolean;
  default?: string;
}

interface TableIndex {
  id: string;
  name: string;
  columns: string[];
  unique: boolean;
}

const DATABASE_TEMPLATES = [
  {
    id: 'ecommerce',
    name: 'E-Commerce DB',
    description: 'Products, orders, customers',
    icon: '🛒',
    tables: 5,
  },
  {
    id: 'blog',
    name: 'Blog Platform',
    description: 'Posts, comments, users',
    icon: '📝',
    tables: 4,
  },
  {
    id: 'social',
    name: 'Social Network',
    description: 'Users, posts, follows',
    icon: '👥',
    tables: 6,
  },
  {
    id: 'crm',
    name: 'CRM System',
    description: 'Leads, contacts, deals',
    icon: '📊',
    tables: 5,
  },
  {
    id: 'saas',
    name: 'SaaS Platform',
    description: 'Teams, subscriptions, usage',
    icon: '🚀',
    tables: 7,
  },
  {
    id: 'analytics',
    name: 'Analytics DB',
    description: 'Events, metrics, dashboards',
    icon: '📈',
    tables: 4,
  },
];

const COLUMN_TYPES = [
  { id: 'string', name: 'String', icon: '📝', description: 'Text (varchar)' },
  { id: 'number', name: 'Number', icon: '🔢', description: 'Integer/Float' },
  { id: 'boolean', name: 'Boolean', icon: '✓', description: 'True/False' },
  { id: 'date', name: 'Date', icon: '📅', description: 'Date/Time' },
  { id: 'json', name: 'JSON', icon: '{}', description: 'JSON object' },
  { id: 'text', name: 'Text', icon: '📄', description: 'Long text' },
  { id: 'uuid', name: 'UUID', icon: '🆔', description: 'Unique ID' },
];

export default function DatabaseBuilderScreen() {
  const [databases, setDatabases] = useState<Database[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [dbName, setDbName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [dbType, setDbType] = useState<'postgresql' | 'mysql' | 'mongodb' | 'sqlite'>('postgresql');

  const handleCreateFromTemplate = useCallback((templateId: string) => {
    setSelectedTemplate(templateId);
    setShowNameInput(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleCreateDatabase = useCallback(() => {
    if (!dbName.trim() || !selectedTemplate) {
      Alert.alert('Error', 'Please enter a database name');
      return;
    }

    const template = DATABASE_TEMPLATES.find(t => t.id === selectedTemplate);
    if (!template) return;

    const newDatabase: Database = {
      id: Date.now().toString(),
      name: dbName,
      type: dbType,
      tables: Array.from({ length: template.tables }, (_, i) => ({
        id: `table-${i}`,
        name: `table_${i + 1}`,
        columns: [
          {
            id: 'id',
            name: 'id',
            type: 'uuid',
            nullable: false,
            unique: true,
          },
          {
            id: 'created_at',
            name: 'created_at',
            type: 'date',
            nullable: false,
            unique: false,
          },
        ],
        indexes: [
          {
            id: 'idx-id',
            name: 'idx_id',
            columns: ['id'],
            unique: true,
          },
        ],
        primaryKey: 'id',
      })),
      createdAt: new Date(),
    };

    setDatabases([...databases, newDatabase]);
    setDbName('');
    setSelectedTemplate(null);
    setShowNameInput(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [dbName, selectedTemplate, dbType, databases]);

  const handleGenerateSQL = useCallback((dbId: string) => {
    const db = databases.find(d => d.id === dbId);
    if (!db) return;

    const sql = generateSQL(db);
    Alert.alert('SQL Generated', `Generated ${sql.split(';').length} SQL statements`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [databases]);

  const handleExportSchema = useCallback((dbId: string) => {
    const db = databases.find(d => d.id === dbId);
    if (!db) return;

    Alert.alert('Export', `Exporting schema for ${db.name}...`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [databases]);

  const TemplateCard = ({ template }: { template: typeof DATABASE_TEMPLATES[0] }) => (
    <Pressable
      onPress={() => handleCreateFromTemplate(template.id)}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      className="bg-surface rounded-2xl p-4 mb-3 border border-border"
    >
      <View className="gap-2">
        <View className="flex-row items-center gap-3">
          <Text className="text-3xl">{template.icon}</Text>
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground">{template.name}</Text>
            <Text className="text-xs text-muted">{template.tables} tables</Text>
          </View>
        </View>
        <Text className="text-sm text-muted">{template.description}</Text>
      </View>
    </Pressable>
  );

  const DatabaseCard = ({ database }: { database: Database }) => (
    <Pressable
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      className="bg-surface rounded-2xl p-4 mb-3 border border-border"
    >
      <View className="gap-3">
        <View>
          <Text className="text-lg font-bold text-foreground">{database.name}</Text>
          <Text className="text-xs text-primary mt-1 uppercase">{database.type}</Text>
          <Text className="text-xs text-muted mt-1">{database.tables.length} tables</Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => handleGenerateSQL(database.id)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            className="flex-1 bg-primary rounded-lg py-2 items-center"
          >
            <Text className="text-primaryForeground font-semibold text-sm">Generate SQL</Text>
          </Pressable>
          <Pressable
            onPress={() => handleExportSchema(database.id)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            className="flex-1 bg-primary/20 rounded-lg py-2 items-center"
          >
            <Text className="text-primary font-semibold text-sm">Export</Text>
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
            <Text className="text-3xl font-bold text-foreground">Database Builder</Text>
            <Text className="text-base text-muted">Design and generate database schemas</Text>
          </View>

          {/* Quick Start */}
          <View className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-4 border border-primary/20 gap-2">
            <Text className="text-sm font-semibold text-primary">🗄️ Quick Start</Text>
            <Text className="text-lg font-bold text-foreground">Choose a Template</Text>
            <Text className="text-sm text-muted">Start with pre-designed database schemas</Text>
          </View>

          {/* Templates */}
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-foreground">Database Templates</Text>
              <Pressable
                onPress={() => setShowTemplateModal(true)}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <Text className="text-primary font-semibold">View All →</Text>
              </Pressable>
            </View>
            {DATABASE_TEMPLATES.slice(0, 3).map(template => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </View>

          {/* Your Databases */}
          {databases.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-bold text-foreground">Your Databases ({databases.length})</Text>
              {databases.map(database => (
                <DatabaseCard key={database.id} database={database} />
              ))}
            </View>
          )}

          {/* Column Types */}
          <View className="gap-3 mt-4">
            <Text className="text-lg font-bold text-foreground">Column Types</Text>
            {COLUMN_TYPES.map(colType => (
              <View key={colType.id} className="bg-surface rounded-2xl p-4 border border-border flex-row items-center gap-3">
                <Text className="text-2xl">{colType.icon}</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-foreground">{colType.name}</Text>
                  <Text className="text-xs text-muted">{colType.description}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Database Types */}
          <View className="gap-3 mt-4">
            <Text className="text-lg font-bold text-foreground">Supported Databases</Text>
            <View className="flex-row flex-wrap gap-2">
              {['PostgreSQL', 'MySQL', 'MongoDB', 'SQLite'].map(db => (
                <View key={db} className="bg-surface rounded-lg px-3 py-2 border border-border">
                  <Text className="text-xs font-semibold text-foreground">{db}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Template Modal */}
      <Modal visible={showTemplateModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50">
          <View className="flex-1 bg-background mt-12 rounded-t-3xl">
            <View className="px-6 py-4 border-b border-border flex-row items-center justify-between">
              <Text className="text-xl font-bold text-foreground">All Templates</Text>
              <Pressable onPress={() => setShowTemplateModal(false)}>
                <Text className="text-2xl text-foreground">✕</Text>
              </Pressable>
            </View>
            <ScrollView className="flex-1 px-6 py-4">
              {DATABASE_TEMPLATES.map(template => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Database Name Input Modal */}
      <Modal visible={showNameInput} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 items-center justify-center">
          <View className="bg-background rounded-3xl p-6 w-5/6 gap-4">
            <Text className="text-xl font-bold text-foreground">Create New Database</Text>
            <TextInput
              placeholder="Enter database name"
              value={dbName}
              onChangeText={setDbName}
              className="bg-surface border border-border rounded-lg p-3 text-foreground"
              placeholderTextColor="#999"
            />
            <View className="gap-2">
              <Text className="text-sm font-semibold text-foreground">Database Type</Text>
              <View className="flex-row gap-2">
                {(['postgresql', 'mysql', 'mongodb', 'sqlite'] as const).map(type => (
                  <Pressable
                    key={type}
                    onPress={() => setDbType(type)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    className={`flex-1 rounded-lg py-2 items-center border ${
                      dbType === type ? 'bg-primary border-primary' : 'bg-surface border-border'
                    }`}
                  >
                    <Text className={`text-xs font-semibold ${dbType === type ? 'text-primaryForeground' : 'text-foreground'}`}>
                      {type.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => {
                  setDbName('');
                  setShowNameInput(false);
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                className="flex-1 bg-surface border border-border rounded-lg py-3 items-center"
              >
                <Text className="text-foreground font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleCreateDatabase}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                className="flex-1 bg-primary rounded-lg py-3 items-center"
              >
                <Text className="text-primaryForeground font-semibold">Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function generateSQL(database: Database): string {
  return database.tables.map(table => `
CREATE TABLE ${table.name} (
  ${table.columns.map(col => 
    `${col.name} ${col.type.toUpperCase()}${col.nullable ? '' : ' NOT NULL'}${col.unique ? ' UNIQUE' : ''}${col.default ? ` DEFAULT ${col.default}` : ''}`
  ).join(',\n  ')},
  PRIMARY KEY (${table.primaryKey})
);
  `.trim()).join('\n\n');
}
