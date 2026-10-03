import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, Pressable, TextInput, Modal, Alert, FlatList } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import * as Haptics from 'expo-haptics';

interface WebsiteDesign {
  id: string;
  name: string;
  domain: string;
  pages: WebPage[];
  theme: WebTheme;
  seo: SEOSettings;
}

interface WebPage {
  id: string;
  title: string;
  slug: string;
  sections: PageSection[];
  meta: {
    description: string;
    keywords: string[];
  };
}

interface PageSection {
  id: string;
  type: 'hero' | 'features' | 'testimonials' | 'cta' | 'gallery' | 'blog' | 'contact' | 'footer';
  content: Record<string, any>;
}

interface WebTheme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
}

interface SEOSettings {
  title: string;
  description: string;
  keywords: string[];
  ogImage: string;
}

const WEBSITE_TEMPLATES = [
  {
    id: 'portfolio',
    name: 'Portfolio Website',
    description: 'Showcase your work and skills',
    icon: '🎨',
    pages: ['Home', 'About', 'Portfolio', 'Blog', 'Contact'],
  },
  {
    id: 'business',
    name: 'Business Website',
    description: 'Professional business presence',
    icon: '💼',
    pages: ['Home', 'Services', 'About', 'Team', 'Contact'],
  },
  {
    id: 'ecommerce',
    name: 'E-Commerce Store',
    description: 'Sell products online',
    icon: '🛒',
    pages: ['Home', 'Shop', 'Product', 'Cart', 'Checkout'],
  },
  {
    id: 'blog',
    name: 'Blog Platform',
    description: 'Share your thoughts and ideas',
    icon: '📝',
    pages: ['Home', 'Blog', 'Article', 'Author', 'Contact'],
  },
  {
    id: 'saas',
    name: 'SaaS Landing',
    description: 'Software as a Service landing page',
    icon: '🚀',
    pages: ['Home', 'Features', 'Pricing', 'Docs', 'Contact'],
  },
  {
    id: 'agency',
    name: 'Agency Website',
    description: 'Creative agency showcase',
    icon: '🎯',
    pages: ['Home', 'Services', 'Work', 'Team', 'Contact'],
  },
];

const PAGE_SECTIONS = [
  { id: 'hero', name: 'Hero Section', icon: '🎬', description: 'Eye-catching header' },
  { id: 'features', name: 'Features', icon: '⭐', description: 'Highlight key features' },
  { id: 'testimonials', name: 'Testimonials', icon: '💬', description: 'Client reviews' },
  { id: 'cta', name: 'Call to Action', icon: '🔔', description: 'Conversion button' },
  { id: 'gallery', name: 'Gallery', icon: '🖼️', description: 'Image showcase' },
  { id: 'blog', name: 'Blog Posts', icon: '📰', description: 'Article list' },
  { id: 'contact', name: 'Contact Form', icon: '📧', description: 'Get in touch' },
  { id: 'footer', name: 'Footer', icon: '🔗', description: 'Site footer' },
];

export default function WebsiteBuilderScreen() {
  const [websites, setWebsites] = useState<WebsiteDesign[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [websiteName, setWebsiteName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);

  const handleCreateFromTemplate = useCallback((templateId: string) => {
    setSelectedTemplate(templateId);
    setShowNameInput(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleCreateWebsite = useCallback(() => {
    if (!websiteName.trim() || !selectedTemplate) {
      Alert.alert('Error', 'Please enter a website name');
      return;
    }

    const template = WEBSITE_TEMPLATES.find(t => t.id === selectedTemplate);
    if (!template) return;

    const newWebsite: WebsiteDesign = {
      id: Date.now().toString(),
      name: websiteName,
      domain: websiteName.toLowerCase().replace(/\s+/g, '-') + '.com',
      pages: template.pages.map((pageName, index) => ({
        id: `page-${index}`,
        title: pageName,
        slug: pageName.toLowerCase().replace(/\s+/g, '-'),
        sections: [],
        meta: {
          description: `${pageName} page`,
          keywords: [pageName.toLowerCase()],
        },
      })),
      theme: {
        name: 'Modern',
        colors: {
          primary: '#0a7ea4',
          secondary: '#f59e0b',
          accent: '#8b5cf6',
          background: '#ffffff',
          text: '#1f2937',
        },
        fonts: {
          heading: 'Inter',
          body: 'Inter',
        },
      },
      seo: {
        title: websiteName,
        description: `Welcome to ${websiteName}`,
        keywords: [websiteName.toLowerCase()],
        ogImage: '',
      },
    };

    setWebsites([...websites, newWebsite]);
    setWebsiteName('');
    setSelectedTemplate(null);
    setShowNameInput(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [websiteName, selectedTemplate, websites]);

  const handleGenerateHTML = useCallback((websiteId: string) => {
    const website = websites.find(w => w.id === websiteId);
    if (!website) return;

    const html = generateHTMLCode(website);
    Alert.alert('HTML Generated', `Generated ${html.split('\n').length} lines of HTML code`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [websites]);

  const handlePublish = useCallback((websiteId: string) => {
    const website = websites.find(w => w.id === websiteId);
    if (!website) return;

    Alert.alert('Publishing', `Publishing ${website.name} to ${website.domain}...`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [websites]);

  const TemplateCard = ({ template }: { template: typeof WEBSITE_TEMPLATES[0] }) => (
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
            <Text className="text-xs text-muted">{template.pages.length} pages</Text>
          </View>
        </View>
        <Text className="text-sm text-muted">{template.description}</Text>
      </View>
    </Pressable>
  );

  const WebsiteCard = ({ website }: { website: WebsiteDesign }) => (
    <Pressable
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      className="bg-surface rounded-2xl p-4 mb-3 border border-border"
    >
      <View className="gap-3">
        <View>
          <Text className="text-lg font-bold text-foreground">{website.name}</Text>
          <Text className="text-xs text-primary mt-1">{website.domain}</Text>
          <Text className="text-xs text-muted mt-1">{website.pages.length} pages</Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => handleGenerateHTML(website.id)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            className="flex-1 bg-primary rounded-lg py-2 items-center"
          >
            <Text className="text-white font-semibold text-sm">Generate HTML</Text>
          </Pressable>
          <Pressable
            onPress={() => handlePublish(website.id)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            className="flex-1 bg-primary/20 rounded-lg py-2 items-center"
          >
            <Text className="text-primary font-semibold text-sm">Publish</Text>
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
            <Text className="text-3xl font-bold text-foreground">Website Builder</Text>
            <Text className="text-base text-muted">Create and deploy websites with AI</Text>
          </View>

          {/* Quick Start */}
          <View className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-4 border border-primary/20 gap-2">
            <Text className="text-sm font-semibold text-primary">🌐 Quick Start</Text>
            <Text className="text-lg font-bold text-foreground">Choose a Template</Text>
            <Text className="text-sm text-muted">Start building your website in minutes</Text>
          </View>

          {/* Templates */}
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-foreground">Website Templates</Text>
              <Pressable
                onPress={() => setShowTemplateModal(true)}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <Text className="text-primary font-semibold">View All →</Text>
              </Pressable>
            </View>
            {WEBSITE_TEMPLATES.slice(0, 3).map(template => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </View>

          {/* Your Websites */}
          {websites.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-bold text-foreground">Your Websites ({websites.length})</Text>
              {websites.map(website => (
                <WebsiteCard key={website.id} website={website} />
              ))}
            </View>
          )}

          {/* Page Sections */}
          <View className="gap-3 mt-4">
            <Text className="text-lg font-bold text-foreground">Available Sections</Text>
            {PAGE_SECTIONS.map(section => (
              <View key={section.id} className="bg-surface rounded-2xl p-4 border border-border flex-row items-center gap-3">
                <Text className="text-2xl">{section.icon}</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-foreground">{section.name}</Text>
                  <Text className="text-xs text-muted">{section.description}</Text>
                </View>
              </View>
            ))}
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
              {WEBSITE_TEMPLATES.map(template => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Website Name Input Modal */}
      <Modal visible={showNameInput} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 items-center justify-center">
          <View className="bg-background rounded-3xl p-6 w-5/6 gap-4">
            <Text className="text-xl font-bold text-foreground">Create New Website</Text>
            <TextInput
              placeholder="Enter website name"
              value={websiteName}
              onChangeText={setWebsiteName}
              className="bg-surface border border-border rounded-lg p-3 text-foreground"
              placeholderTextColor="#999"
            />
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => {
                  setWebsiteName('');
                  setShowNameInput(false);
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                className="flex-1 bg-surface border border-border rounded-lg py-3 items-center"
              >
                <Text className="text-foreground font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleCreateWebsite}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                className="flex-1 bg-primary rounded-lg py-3 items-center"
              >
                <Text className="text-white font-semibold">Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function generateHTMLCode(website: WebsiteDesign): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${website.seo.title}</title>
    <meta name="description" content="${website.seo.description}">
    <meta name="keywords" content="${website.seo.keywords.join(', ')}">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: '${website.theme.fonts.body}', sans-serif; color: ${website.theme.colors.text}; }
        header { background: ${website.theme.colors.primary}; color: white; padding: 20px; }
        main { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
        h1 { font-family: '${website.theme.fonts.heading}', sans-serif; }
    </style>
</head>
<body>
    <header>
        <h1>${website.name}</h1>
    </header>
    <nav>
        ${website.pages.map(page => `<a href="/${page.slug}">${page.title}</a>`).join('\n        ')}
    </nav>
    <main>
        ${website.pages.map(page => `
        <section id="${page.slug}">
            <h2>${page.title}</h2>
            <p>${page.meta.description}</p>
        </section>
        `).join('\n        ')}
    </main>
</body>
</html>
  `.trim();
}
