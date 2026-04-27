export interface ExaSearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface ExaResult {
  title: string;
  url: string;
  text?: string;
}

interface ExaResponse {
  results: ExaResult[];
}

export async function exaSearch(
  query: string,
  apiKey: string
): Promise<ExaSearchResult[]> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Exa API key is required');
  }

  const response = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      query,
      numResults: 5,
      useAutoprompt: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Exa API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as ExaResponse;

  return (data.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.text ?? '',
  }));
}
