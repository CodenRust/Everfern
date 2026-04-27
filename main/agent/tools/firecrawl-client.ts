interface FirecrawlRequest {
  url: string;
  formats: ['markdown'];
}

interface FirecrawlResponse {
  success: boolean;
  data: {
    markdown: string;
  };
}

export async function firecrawlCrawl(
  url: string,
  apiKey: string
): Promise<string> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Firecrawl API key is required');
  }

  const body: FirecrawlRequest = { url, formats: ['markdown'] };

  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `Firecrawl API error: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as FirecrawlResponse;

  return data.data.markdown;
}
