import type { ApiResponse, DomainInfo } from './types';
import { config } from './config';

export async function inspectDomain(domain: string): Promise<ApiResponse> {
  // === ТЕСТОВЫЙ API (РАБОЧИЙ) ===
  // Используем рабочий API с запрошенным доменом
  // TODO: Заменить на реальный API endpoint при необходимости
  const url = `https://domain-inspector-backend.vercel.app/api/inspect?domain=${encodeURIComponent(domain)}`;
  
  // === РЕАЛЬНЫЙ API (АЛЬТЕРНАТИВА) ===
  // TODO: Раскомментировать для другого API endpoint
  // const url = `${config.apiBaseUrl}/api/inspect?domain=${encodeURIComponent(domain)}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.apiTimeout);

  try {
    const startTime = Date.now();
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': `${config.appName}/${config.appVersion}`
      }
    });

    const endTime = Date.now();
    const requestDuration = endTime - startTime;
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      config.error('❌ API Response Error:', {
        status: response.status,
        statusText: response.statusText,
        url: url
      });
      
      if (response.status === 404) {
        throw new Error('Domain not found');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      throw new Error(`API error: ${response.status}`);
    }
    
    const rawData = await response.json();
    
    // === АДАПТАЦИЯ ОТВЕТА API ===
    // API возвращает прямые данные, оборачиваем в ApiResponse
    // TODO: Убрать эту адаптацию, если API возвращает ApiResponse напрямую
    const apiResponse: ApiResponse = {
      success: true,
      data: rawData as DomainInfo,
      cached: rawData.cached || false
    };
    
    return apiResponse;
    
    // === РЕАЛЬНЫЙ API (ЕСЛИ ВОЗВРАЩАЕТ ApiResponse) ===
    // TODO: Раскомментировать если API возвращает ApiResponse
    // return rawData as ApiResponse;
    
  } catch (error) {
    clearTimeout(timeoutId);

    config.error('💥 API Request Failed:', {
      error: error,
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Unknown',
      url: url,
      domain: domain
    });

    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out. Please try again.';
        config.error('⏰ Request timeout after', config.apiTimeout + 'ms');
      } else {
        errorMessage = error.message;
        config.error('❌ Error message:', error.message);
      }
    }

    const errorResponse = {
      success: false,
      data: null,
      error: errorMessage
    };
    
    return errorResponse;
  }
}
