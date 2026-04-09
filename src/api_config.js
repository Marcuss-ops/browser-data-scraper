// API Configuration for video sources

export const PIXABAY_API_KEY = '55327477-246ca9e690f402753b4d8491b';
export const PIXABAY_API_BASE = 'https://pixabay.com/api';

export const PEXELS_API_KEY = 'bpfaewdM9Tui4q0shyblk5sQzI2PdVYXErbBkxlHNTgh1F0OIiqcYTV0';
export const PEXELS_API_BASE = 'https://api.pexels.com/videos';

// Default search parameters
export const DEFAULT_PARAMS = {
  per_page: 50,
  order: 'popular',
  safesearch: 'false'
};

// Rate limiting configuration
export const RATE_LIMITS = {
  pixabay: {
    maxRequestsPerMinute: 100,
    delayBetweenRequests: 600 // ms
  },
  pexels: {
    maxRequestsPerMinute: 200,
    delayBetweenRequests: 300 // ms
  }
};
