import type { ApiResponse } from './types';
import { config } from './config';

export async function inspectDomain(domain: string): Promise<ApiResponse> {
  const url = `${config.apiBaseUrl}/api/inspect?domain=${encodeURIComponent(domain)}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.apiTimeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Domain not found');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data as ApiResponse;
  } catch (error) {
    clearTimeout(timeoutId);
    config.error('Failed to inspect domain:', error);

    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out. Please try again.';
      } else {
        errorMessage = error.message;
      }
    }

    return {
      success: false,
      data: null,
      error: errorMessage
    };
  }
}
