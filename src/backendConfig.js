export const PUBLIC_BACKEND_URL =
  'https://vertex-ai-backend.blackground-adae2791.southindia.azurecontainerapps.io';

const normalizeApiUrl = url => {
  const trimmed = String(url || '')
    .trim()
    .replace(/\/+$/, '');
  if (!trimmed) {
    return '';
  }
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const cloudApiUrl = normalizeApiUrl(PUBLIC_BACKEND_URL);

const LOCAL_API_BASE_URLS = [
  'http://172.20.10.2:5000/api',
  'http://10.146.222.235:5000/api',
  'http://10.64.167.235:5000/api',
  'http://10.32.184.235:5000/api',
  'http://10.0.2.2:5000/api',
  'http://localhost:5000/api',
];

export const IS_CLOUD_BACKEND_CONFIGURED = Boolean(cloudApiUrl);

export const API_BASE_URLS = IS_CLOUD_BACKEND_CONFIGURED
  ? [cloudApiUrl]
  : LOCAL_API_BASE_URLS;
