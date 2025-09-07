import { PinterestApiResponse } from '../types';

const API_BASE_URL = 'https://api.scrapecreators.com/v1/pinterest/search';

export const searchPins = async (query: string, apiKey: string, cursor: string | null = null): Promise<PinterestApiResponse> => {
  if (!apiKey) {
    throw new Error('API key is required.');
  }

  const url = new URL(API_BASE_URL);
  url.searchParams.append('query', query);
  url.searchParams.append('trim', 'true'); // Optimize response payload
  if (cursor) {
    url.searchParams.append('cursor', cursor);
  }

  const response = await fetch(url.toString(), {
    headers: {
      'x-api-key': apiKey, // API key must be sent in the header
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid API key. Please check and try again.');
    }
    throw new Error(`Failed to fetch pins: ${response.statusText}`);
  }

  const data = await response.json();
  
  // The response data is under the 'pins' key, not 'data'.
  return { data: data.pins || [], cursor: data.cursor || null };
};
