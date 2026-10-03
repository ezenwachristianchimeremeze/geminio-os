/**
 * AI Integrations Module
 * Provides access to Anthropic Claude, OpenRouter, embeddings, TTS, and on-device ML
 */

/**
 * Anthropic Claude Integration
 */
export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export async function callClaudeAPI(
  messages: ClaudeMessage[],
  model: string = 'claude-3-sonnet-20240229',
  apiKey?: string
): Promise<ClaudeResponse> {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Streaming Claude Response
 */
export async function* streamClaudeResponse(
  messages: ClaudeMessage[],
  model: string = 'claude-3-sonnet-20240229',
  apiKey?: string
): AsyncGenerator<string> {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta.type === 'text_delta') {
            yield parsed.delta.text;
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }
}

/**
 * OpenRouter Integration
 */
export interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function callOpenRouterAPI(
  messages: OpenRouterMessage[],
  model: string = 'openai/gpt-4-turbo-preview',
  apiKey?: string
): Promise<any> {
  const key = apiKey || process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY not set');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://geminios.app',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Text Embeddings
 * Generate vector embeddings for semantic search
 */
export async function generateEmbeddings(
  text: string,
  model: string = 'text-embedding-3-small',
  apiKey?: string
): Promise<number[]> {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embeddings API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Semantic Search using Embeddings
 */
export async function semanticSearch(
  query: string,
  documents: Array<{ id: string; text: string; embedding?: number[] }>,
  apiKey?: string
): Promise<Array<{ id: string; text: string; similarity: number }>> {
  const queryEmbedding = await generateEmbeddings(query, 'text-embedding-3-small', apiKey);

  // Generate embeddings for documents if not already done
  const docsWithEmbeddings = await Promise.all(
    documents.map(async (doc) => ({
      ...doc,
      embedding: doc.embedding || (await generateEmbeddings(doc.text, 'text-embedding-3-small', apiKey)),
    }))
  );

  // Calculate cosine similarity
  const results = docsWithEmbeddings
    .map((doc) => ({
      id: doc.id,
      text: doc.text,
      similarity: cosineSimilarity(queryEmbedding, doc.embedding!),
    }))
    .sort((a, b) => b.similarity - a.similarity);

  return results;
}

/**
 * Cosine Similarity
 */
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Text-to-Speech
 */
export async function textToSpeech(
  text: string,
  voice: string = 'alloy',
  apiKey?: string
): Promise<ArrayBuffer> {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice,
    }),
  });

  if (!response.ok) {
    throw new Error(`TTS API error: ${response.statusText}`);
  }

  return response.arrayBuffer();
}

/**
 * On-Device ML with TensorFlow Lite
 * Note: This is conceptual. Real implementation requires native modules.
 */
export interface TFLiteModel {
  name: string;
  path: string;
  inputShape: number[];
  outputShape: number[];
}

export async function loadTFLiteModel(modelPath: string): Promise<TFLiteModel> {
  // In a real implementation, use @tensorflow/tfjs-react-native
  console.log(`Loading TensorFlow Lite model from ${modelPath}`);
  return {
    name: 'model',
    path: modelPath,
    inputShape: [1, 224, 224, 3],
    outputShape: [1, 1000],
  };
}

export async function runTFLiteInference(
  model: TFLiteModel,
  input: number[][]
): Promise<number[][]> {
  // In a real implementation, use @tensorflow/tfjs-react-native
  console.log(`Running inference on model ${model.name}`);
  return [[0.1, 0.2, 0.3]]; // Mock output
}

/**
 * AI Model Selection
 */
export const AI_MODELS = {
  CLAUDE_3_OPUS: 'claude-3-opus-20240229',
  CLAUDE_3_SONNET: 'claude-3-sonnet-20240229',
  CLAUDE_3_HAIKU: 'claude-3-haiku-20240307',
  GPT_4_TURBO: 'openai/gpt-4-turbo-preview',
  GPT_4: 'openai/gpt-4',
  GPT_35_TURBO: 'openai/gpt-3.5-turbo',
} as const;

/**
 * AI Response Cache
 */
const responseCache = new Map<string, any>();

export function getCachedResponse(key: string): any | null {
  return responseCache.get(key) || null;
}

export function setCachedResponse(key: string, value: any, ttlMs: number = 3600000): void {
  responseCache.set(key, value);
  setTimeout(() => responseCache.delete(key), ttlMs);
}

export function clearCache(): void {
  responseCache.clear();
}
