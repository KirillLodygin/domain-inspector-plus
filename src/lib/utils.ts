/**
 * Извлечение домена из текста
 */
export function extractDomain(text: string): string | null {
    const domainRegex = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})(?:\/|$|\s)/gi;
    const match = domainRegex.exec(text);
    return match ? match[1].toLowerCase() : null;
}

/**
 * Валидация домена
 */
export function isValidDomain(domain: string): boolean {
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
    return domainRegex.test(domain);
}

/**
 * Форматирование даты (1997-09-15T04:00:00Z → 15 Sep 1997)
 */
export function formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        
        return date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    } catch {
        return dateString;
    }
}

/**
 * Преобразование кода страны в полное название
 */
const COUNTRY_MAP: Record<string, string> = {
    'US': 'United States',
    'GB': 'United Kingdom',
    'DE': 'Germany',
    'FR': 'France',
    'CN': 'China',
    'JP': 'Japan',
    'RU': 'Russia',
    'CA': 'Canada',
    'AU': 'Australia',
    'BR': 'Brazil',
    'IN': 'India',
    'NL': 'Netherlands',
    'SG': 'Singapore',
    'CH': 'Switzerland',
    'UA': 'Ukraine',
};

export function getCountryName(code: string): string {
    if (!code) return 'Unknown';
    const upperCode = code.toUpperCase();
    return COUNTRY_MAP[upperCode] || upperCode;
}

/**
 * Форматирование списка NS серверов
 */
export function formatNS(ns: string[]): { primary: string[]; othersCount: number } {
    if (!ns || ns.length === 0) return { primary: [], othersCount: 0 };
    return {
        primary: ns.slice(0, 2),
        othersCount: Math.max(0, ns.length - 2)
    };
}

/**
 * Копирование текста в буфер обмена
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        // Fallback для старых браузеров
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
    }
}