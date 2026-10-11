import { invokeViaPort, parseModelJson } from "./llm-port";
import type { ProjectMemory } from "./project-memory";

/**
 * UI/UX Code Generation Engine (Phase 5)
 * Generates React Native/Expo screens, components, and navigation
 */

export interface ScreenSpecification {
  id: string;
  name: string;
  description: string;
  layout: "stack" | "tab" | "drawer" | "modal";
  components: ComponentSpec[];
  forms: FormSpec[];
  navigation_targets: string[];
  theme_tokens: string[];
}

export interface ComponentSpec {
  id: string;
  name: string;
  type: "button" | "input" | "card" | "list" | "modal" | "custom";
  props: Record<string, unknown>;
  children: ComponentSpec[];
  styling: string;
}

export interface FormSpec {
  id: string;
  name: string;
  fields: FormField[];
  validation: ValidationRule[];
  submission_handler: string;
}

export interface FormField {
  id: string;
  name: string;
  type: "text" | "email" | "password" | "number" | "select" | "checkbox" | "radio";
  label: string;
  placeholder: string;
  required: boolean;
  validation: ValidationRule[];
}

export interface ValidationRule {
  type: "required" | "email" | "minLength" | "maxLength" | "pattern" | "custom";
  message: string;
  value?: unknown;
}

export class UIGenerator {
  private memory: ProjectMemory;

  constructor(memory: ProjectMemory) {
    this.memory = memory;
  }

  /**
   * Generate React Native screen code
   */
  async generateScreen(spec: ScreenSpecification): Promise<string> {
    const prompt = `
      Generate a production-ready React Native/Expo screen component based on this specification:
      
      ${JSON.stringify(spec, null, 2)}
      
      Requirements:
      - Use TypeScript with full type safety
      - Use NativeWind for styling (Tailwind CSS for React Native)
      - Import from @/components/screen-container for SafeArea handling
      - Use proper error handling and loading states
      - Include JSDoc comments
      - Follow React best practices
      - Use hooks for state management
      - Include proper TypeScript types
      
      Return ONLY the complete TSX code, no explanations.
    `;

    try {
      const response = await invokeViaPort({
        operation: "ui-generator.generateScreen",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 3000,
      });

      const content = typeof response.choices[0]?.message?.content === 'string'
        ? response.choices[0]?.message?.content
        : "";

      this.memory.storeArchitecture(`screen_${spec.id}`, content);
      return content;
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Generate reusable component code
   */
  async generateComponent(spec: ComponentSpec): Promise<string> {
    const prompt = `
      Generate a production-ready React Native component based on this specification:
      
      ${JSON.stringify(spec, null, 2)}
      
      Requirements:
      - Use TypeScript with full type safety
      - Use NativeWind for styling
      - Export as named export
      - Include proper PropTypes or TypeScript interface
      - Add JSDoc comments
      - Make it reusable and composable
      - Include error boundaries
      
      Return ONLY the complete TSX code, no explanations.
    `;

    try {
      const response = await invokeViaPort({
        operation: "ui-generator.generateComponent",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
      });

      const content = typeof response.choices[0]?.message?.content === 'string'
        ? response.choices[0]?.message?.content
        : "";

      this.memory.storeArchitecture(`component_${spec.id}`, content);
      return content;
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Generate form component with validation
   */
  async generateForm(spec: FormSpec): Promise<string> {
    const prompt = `
      Generate a production-ready React Native form component based on this specification:
      
      ${JSON.stringify(spec, null, 2)}
      
      Requirements:
      - Use TypeScript with full type safety
      - Use react-hook-form for form management
      - Implement all validation rules
      - Use NativeWind for styling
      - Add loading and error states
      - Include success feedback
      - Make fields accessible
      - Add haptic feedback on interactions
      
      Return ONLY the complete TSX code, no explanations.
    `;

    try {
      const response = await invokeViaPort({
        operation: "ui-generator.generateForm",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2500,
      });

      const content = typeof response.choices[0]?.message?.content === 'string'
        ? response.choices[0]?.message?.content
        : "";

      this.memory.storeArchitecture(`form_${spec.id}`, content);
      return content;
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Generate navigation configuration
   */
  async generateNavigation(screens: ScreenSpecification[]): Promise<string> {
    const prompt = `
      Generate a complete Expo Router navigation configuration for these screens:
      
      ${JSON.stringify(screens, null, 2)}
      
      Requirements:
      - Use Expo Router v6
      - Create proper file structure
      - Include tab navigation if needed
      - Add deep linking support
      - Include proper TypeScript types
      - Add navigation parameters
      
      Return ONLY the complete TypeScript code for the layout file, no explanations.
    `;

    try {
      const response = await invokeViaPort({
        operation: "ui-generator.generateNavigation",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
      });

      const content = typeof response.choices[0]?.message?.content === 'string'
        ? response.choices[0]?.message?.content
        : "";

      this.memory.storeArchitecture("navigation_config", content);
      return content;
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Generate responsive layout
   */
  async generateResponsiveLayout(spec: ScreenSpecification): Promise<string> {
    const prompt = `
      Generate a responsive React Native layout that works on all screen sizes:
      
      ${JSON.stringify(spec, null, 2)}
      
      Requirements:
      - Use Flexbox for responsive design
      - Handle portrait and landscape orientations
      - Use NativeWind breakpoints
      - Optimize for mobile, tablet, and web
      - Include proper spacing and padding
      - Ensure touch targets are 44x44 minimum
      
      Return ONLY the complete TSX code, no explanations.
    `;

    try {
      const response = await invokeViaPort({
        operation: "ui-generator.generateResponsiveLayout",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
      });

      const content = typeof response.choices[0]?.message?.content === 'string'
        ? response.choices[0]?.message?.content
        : "";

      return content;
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Generate theme configuration
   */
  async generateThemeConfig(colors: Record<string, string>): Promise<string> {
    const prompt = `
      Generate a complete NativeWind/Tailwind theme configuration with these colors:
      
      ${JSON.stringify(colors, null, 2)}
      
      Requirements:
      - Create theme.config.js
      - Include light and dark mode colors
      - Add typography scales
      - Add spacing scale
      - Add border radius
      - Add shadows
      - Ensure WCAG AA contrast compliance
      
      Return ONLY the complete JavaScript code for theme.config.js, no explanations.
    `;

    try {
      const response = await invokeViaPort({
        operation: "ui-generator.generateThemeConfig",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1500,
      });

      const content = typeof response.choices[0]?.message?.content === 'string'
        ? response.choices[0]?.message?.content
        : "";

      return content;
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
}

/**
 * Global UI Generator manager
 */
class UIGeneratorManager {
  private generators: Map<string, UIGenerator> = new Map();

  createGenerator(projectId: string, memory: ProjectMemory): UIGenerator {
    const generator = new UIGenerator(memory);
    this.generators.set(projectId, generator);
    return generator;
  }

  getGenerator(projectId: string): UIGenerator | undefined {
    return this.generators.get(projectId);
  }

  deleteGenerator(projectId: string): boolean {
    return this.generators.delete(projectId);
  }
}

export const uiGeneratorManager = new UIGeneratorManager();
