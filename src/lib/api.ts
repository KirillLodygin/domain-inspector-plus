import type { ApiResponse, DomainInfo } from './types';
import { config } from './config';

export async function inspectDomain(domain: string): Promise<ApiResponse> {
  // === ТЕСТОВЫЙ API (ЗАГЛУШКА) ===
  // Для тестирования используем всегда google.com как рабочий домен
  // TODO: Убрать эту заглушку при подключении реального API
  const testDomain = 'google.com';
  const url = `https://domain-inspector-backend.vercel.app/api/inspect?domain=${encodeURIComponent(testDomain)}`;
  
  // === РЕАЛЬНЫЙ API (ЗАКОММЕНТИРОВАНО) ===
  // TODO: Раскомментировать для реального API
  // const url = `${config.apiBaseUrl}/api/inspect?domain=${encodeURIComponent(domain)}`;
  
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
    
    const rawData = await response.json();
    
    // === ТЕСТОВЫЙ API (АДАПТАЦИЯ ОТВЕТА) ===
    // Тестовый API возвращает прямые данные, оборачиваем в ApiResponse
    // TODO: Убрать эту адаптацию при реальном API (если он возвращает ApiResponse)
    const apiResponse: ApiResponse = {
      success: true,
      data: {
        ...rawData,
        domain: domain // Подменяем домен на запрошенный
      } as DomainInfo,
      cached: rawData.cached
    };
    
    return apiResponse;
    
    // === РЕАЛЬНЫЙ API (ЕСЛИ ВОЗВРАЩАЕТ ApiResponse) ===
    // TODO: Раскомментировать для реального API
    // return rawData as ApiResponse;
    
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
