export interface DomainInfo {
    domain: string;
    created: string;
    expires: string;
    registrar: string;
    ip: string;
    country: string;
    asn: string;
    ns: string[];
}

export interface ApiResponse {
    success: boolean;
    data: DomainInfo | null;
    error?: string;
    cached?: boolean;
}

export interface HighlightedDomain {
    domain: string;
    element: HTMLElement;
    rect: DOMRect;
}