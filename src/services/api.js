import {getToken} from '../utils/storage';
import {API_BASE_URLS, IS_CLOUD_BACKEND_CONFIGURED} from '../backendConfig';

let cachedBaseUrl = API_BASE_URLS[0];

const timeoutFetch = (url, options = {}, timeout = 12000) => {
  const controller = new AbortController();
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      const error = new Error('Request timeout');
      error.name = 'AbortError';
      reject(error);
    }, timeout);
  });
  const requestPromise = fetch(url, {...options, signal: controller.signal});
  return Promise.race([requestPromise, timeoutPromise]).finally(() =>
    clearTimeout(timer),
  );
};

const uniqueUrls = urls => [...new Set(urls.filter(Boolean))];

const requestUrls = () => {
  if (IS_CLOUD_BACKEND_CONFIGURED) {
    return uniqueUrls([API_BASE_URLS[0]]);
  }
  return uniqueUrls([
    cachedBaseUrl,
    ...API_BASE_URLS.filter(baseUrl => baseUrl !== cachedBaseUrl),
  ]);
};

export const apiRequest = async (path, options = {}) => {
  const token = await getToken();
  let lastError;
  const urls = requestUrls();
  for (const baseUrl of urls) {
    try {
      const response = await timeoutFetch(
        `${baseUrl}${path}`,
        {
          method: options.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? {Authorization: `Bearer ${token}`} : {}),
            ...options.headers,
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
        },
        options.timeout || 12000,
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || `Request failed (${response.status})`);
      }
      cachedBaseUrl = baseUrl;
      return data;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    lastError?.name === 'AbortError'
      ? IS_CLOUD_BACKEND_CONFIGURED
        ? 'Cloud backend timeout. Thodi der baad dobara try karo.'
        : 'Backend timeout. Cloud backend URL set nahi hai.'
      : lastError?.message ||
        (IS_CLOUD_BACKEND_CONFIGURED
          ? 'Cloud backend connect nahi hua.'
          : 'Backend connect nahi hua. Cloud backend URL set nahi hai.'),
  );
};

export const resolveApiBaseUrl = async () => {
  const urls = requestUrls();
  for (const baseUrl of urls) {
    try {
      const response = await timeoutFetch(`${baseUrl}/health`, {}, 3500);
      if (response.ok) {
        cachedBaseUrl = baseUrl;
        return baseUrl;
      }
    } catch {}
  }
  return cachedBaseUrl;
};

export const getOAuthStartUrl = async provider =>
  `${await resolveApiBaseUrl()}/auth/oauth/${provider}`;

export const loginUser = ({email, password}) =>
  apiRequest('/auth/login', {
    method: 'POST',
    body: {email, password},
  });

export const signupUser = ({name, email, password}) =>
  apiRequest('/auth/signup', {
    method: 'POST',
    body: {name, email, password},
  });

export const socialLoginUser = ({provider, name, email, providerId}) =>
  apiRequest('/auth/social', {
    method: 'POST',
    body: {provider, name, email, providerId},
  });

export const buildSystemPrompt = (
  customPrompt = '',
) => `You are vertex.ai - a highly intelligent, friendly AI assistant.

IDENTITY: Your name is vertex.ai. NEVER reveal you are powered by Gemini or any other model. If asked, say "Main vertex.ai hoon - ek custom AI assistant".

LANGUAGE: Auto-detect language. Reply in the same language. Hindi+English mix = Hinglish.

STYLE: Be clear, practical, friendly, and concise. Format with markdown when useful.

${customPrompt ? `CUSTOM PERSONA: ${customPrompt}` : ''}`;

export const callChat = async ({
  history,
  systemPrompt,
  provider = 'vertex',
}) => {
  const data = await apiRequest('/chat', {
    method: 'POST',
    body: {history, systemPrompt, provider},
    timeout: 25000,
  });
  return {
    reply: data.reply || 'Response empty raha. Dobara try karo.',
    tool: data.tool || null,
  };
};

export const callAI = async ({history, systemPrompt, provider}) => {
  const data = await callChat({history, systemPrompt, provider});
  return data.reply;
};

export const generateToolContent = async (prompt, provider = 'vertex') => {
  const body =
    prompt && typeof prompt === 'object'
      ? {...prompt, provider}
      : {prompt, provider};
  const data = await apiRequest('/tools/generate', {
    method: 'POST',
    body,
    timeout:
      body.type === 'website' || body.type === 'app' || body.action === 'refine'
        ? 120000
        : 60000,
  });
  return data.output || 'Output empty raha. Dobara try karo.';
};

export const generateTool = async (body, provider = 'vertex') =>
  apiRequest('/tools/generate', {
    method: 'POST',
    body: {...body, provider},
    timeout:
      body.type === 'image'
        ? 25000
        : body.type === 'website' ||
          body.type === 'app' ||
          body.action === 'refine'
        ? 120000
        : 60000,
  });

export const generateMediaImage = async ({
  prompt,
  style = 'No Style',
  ratio = 'square',
  provider = 'vertex',
}) => {
  const data = await generateTool(
    {
      type: 'image',
      prompt,
      style,
      ratio,
    },
    provider,
  );
  if (!data.tool?.url) {
    throw new Error('Image URL empty raha.');
  }
  return data.tool;
};

export const getMediaProviders = () =>
  apiRequest('/media/providers', {
    method: 'GET',
    timeout: 12000,
  });

export const imageUrlForPrompt = ({prompt, width, height}) =>
  `https://image.pollinations.ai/prompt/${encodeURIComponent(
    prompt,
  )}?width=${width}&height=${height}&nologo=true&enhance=true`;
