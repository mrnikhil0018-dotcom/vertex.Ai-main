export const PUBLIC_BACKEND_URL = 'http://172.20.10.2:5000';

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

export const API_BASE_URLS = [
  cloudApiUrl,
  'http://172.20.10.2:5000/api',
  'http://10.146.222.235:5000/api',
  'http://10.64.167.235:5000/api',
  'http://10.32.184.235:5000/api',
  'http://10.0.2.2:5000/api',
  'http://localhost:5000/api',
].filter(Boolean);

export const IS_CLOUD_BACKEND_CONFIGURED = Boolean(cloudApiUrl);
