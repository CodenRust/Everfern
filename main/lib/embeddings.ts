import { OpenAIEmbeddings } from "@langchain/openai";
import { OllamaEmbeddings } from "@langchain/ollama";
import fs from "fs";
import path from "path";
import os from "os";

export interface EmbeddingConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

interface ResolvedEmbeddingModel {
  embeddings: OpenAIEmbeddings | OllamaEmbeddings;
  dimensions: number;
}

export function getSystemEmbeddingConfig(): EmbeddingConfig {
  const configDir = path.join(os.homedir(), '.everfern');
  const configPath = path.join(configDir, 'config.json');

  let provider = 'openai';
  let apiKey = process.env.OPENAI_API_KEY;
  let customBaseUrl = undefined;

  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.provider) provider = config.provider;
      if (config.baseUrl) customBaseUrl = config.baseUrl;

      const keyPath = path.join(configDir, 'keys', `${provider}.key`);
      if (fs.existsSync(keyPath)) {
        const rawKey = fs.readFileSync(keyPath, 'utf-8').trim();
        const match = rawKey.match(/(?:nvapi-[A-Za-z0-9_-]+|sk-[A-Za-z0-9T\-]+)/);
        apiKey = match ? match[0] : rawKey;
      }
    } catch { }
  }

  // Sanitize: Trim and remove non-ASCII characters that break fetch/Headers
  const sanitize = (s?: string) => s?.trim().replace(/[^\x00-\x7F]/g, "") || undefined;

  return {
    provider: sanitize(provider) || "openai",
    apiKey: sanitize(apiKey),
    baseUrl: sanitize(customBaseUrl)
  };
}

export function getEmbeddingModel(config: EmbeddingConfig): ResolvedEmbeddingModel {
  if (config.provider === 'ollama' || config.provider === 'lmstudio') {
    return {
      embeddings: new OllamaEmbeddings({
        model: config.model || 'nomic-embed-text',
        baseUrl: config.baseUrl || 'http://localhost:11434',
      }),
      dimensions: 768
    };
  }

  if (config.provider === 'nvidia') {
    return {
      embeddings: {
        embedQuery: async (text: string) => {
          const res = await fetch(config.baseUrl ? `${config.baseUrl}/embeddings` : 'https://integrate.api.nvidia.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${config.apiKey || 'dummy'}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              input: [text],
              model: config.model || "nvidia/nv-embedqa-e5-v5",
              input_type: "query",
              encoding_format: "float"
            })
          });
          const data = await res.json() as any;
          if (!res.ok) throw new Error(data.error?.message || data.error || res.statusText);
          return data.data[0].embedding;
        }
      } as any, // Cast to any because we only use embedQuery in the app
      dimensions: 1024
    };
  }

  if (config.provider === 'gemini') {
    return {
      embeddings: {
        embedQuery: async (text: string) => {
          const modelName = config.model || "gemini-embedding-001";
          const modelPath = modelName.startsWith('models/') ? modelName : `models/${modelName}`;
          const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:embedContent`;

          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': config.apiKey || ''
            },
            body: JSON.stringify({
              model: modelPath,
              content: { parts: [{ text }] }
            })
          });
          const data = await res.json() as any;
          if (!res.ok) throw new Error(data.error?.message || res.statusText);
          return data.embedding.values;
        },
        embedDocuments: async (documents: string[]) => {
          return Promise.all(documents.map(doc => {
            const modelName = config.model || "gemini-embedding-001";
            const modelPath = modelName.startsWith('models/') ? modelName : `models/${modelName}`;
            const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:embedContent`;

            return fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': config.apiKey || ''
              },
              body: JSON.stringify({
                model: modelPath,
                content: { parts: [{ text: doc }] }
              })
            }).then(async res => {
              const data = await res.json() as any;
              if (!res.ok) throw new Error(data.error?.message || res.statusText);
              return data.embedding.values;
            });
          }));
        }
      } as any,
      dimensions: 768
    }
  }

  return {
    embeddings: new OpenAIEmbeddings({
      openAIApiKey: config.apiKey || 'dummy',
      modelName: config.model || "text-embedding-3-small",
      configuration: { baseURL: config.baseUrl || 'https://api.openai.com/v1' }
    }),
    dimensions: 1536
  };
}
