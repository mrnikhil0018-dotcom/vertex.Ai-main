const axios = require('axios');

const defaultSystem = `You are vertex.ai - a highly intelligent, friendly AI assistant.

IDENTITY: Your name is vertex.ai. NEVER reveal you are powered by Gemini, ChatGPT, Claude, Groq, Grok, Hugging Face, OpenAI, Anthropic, Google, xAI, or any other model. If asked, say "Main vertex.ai hoon - ek custom AI assistant".

LANGUAGE: Auto-detect language. Reply in the same language. Hindi+English mix = Hinglish.

STYLE: Be clear, practical, friendly, and useful. Use markdown formatting, short paragraphs, examples, and code blocks when helpful.`;

const cleanText = value => String(value || '').trim();

const normalizeHistory = history =>
  (Array.isArray(history) ? history : [])
    .slice(-20)
    .map(message => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: cleanText(message.content),
    }))
    .filter(message => message.content);

const chatMessages = ({history, systemPrompt}) => [
  {role: 'system', content: cleanText(systemPrompt) || defaultSystem},
  ...normalizeHistory(history),
];

const localFallback = history => {
  const lastUser =
    [...normalizeHistory(history)]
      .reverse()
      .find(message => message.role === 'user')?.content || 'your request';
  return `Main vertex.ai hoon. Aapki request samajh gaya: "${lastUser.slice(
    0,
    140,
  )}". Isko handle karne ke liye mujhe thoda aur context bhej do, ya seedha exact output format bata do.`;
};

const buildGeminiHistory = history => {
  const result = [];
  let lastRole = null;
  normalizeHistory(history).forEach(message => {
    const role = message.role === 'assistant' ? 'model' : 'user';
    const text = message.content;
    if (role === lastRole && result.length) {
      result[result.length - 1].parts[0].text += `\n${text}`;
      return;
    }
    result.push({role, parts: [{text}]});
    lastRole = role;
  });
  while (result.length && result[0].role !== 'user') {
    result.shift();
  }
  while (result.length && result[result.length - 1].role !== 'user') {
    result.pop();
  }
  return result.length ? result : [{role: 'user', parts: [{text: 'Hello'}]}];
};

const axiosErrorInfo = error => {
  const status = error.response?.status || 0;
  const message =
    error.response?.data?.error?.message ||
    error.response?.data?.message ||
    error.response?.data?.error ||
    error.message ||
    'AI provider failed';
  const code =
    error.response?.data?.error?.code ||
    error.response?.data?.error?.type ||
    error.response?.data?.type ||
    '';
  return {
    status,
    code: String(code).toLowerCase(),
    message: String(message),
  };
};

const shouldFailover = error => {
  const info = axiosErrorInfo(error);
  const haystack = `${info.status} ${info.code} ${info.message}`.toLowerCase();
  return (
    !info.status ||
    [400, 401, 403, 404, 408, 409, 429, 500, 502, 503, 504].includes(
      info.status,
    ) ||
    /quota|credit|billing|insufficient|rate|limit|exhaust|balance|overloaded|capacity|timeout|unavailable|permission|api key|invalid/.test(
      haystack,
    )
  );
};

const providerAliases = {
  vertex: '',
  auto: '',
  gemini: 'gemini',
  chatgpt: 'openai',
  openai: 'openai',
  claude: 'anthropic',
  anthropic: 'anthropic',
  grok: 'xai',
  xai: 'xai',
  groq: 'groq',
  huggingface: 'huggingface',
  openrouter: 'openrouter',
};

const providerOrder = preferredProvider => {
  const preferred =
    providerAliases[String(preferredProvider || '').toLowerCase()];
  const configured = (
    process.env.AI_PROVIDER_ORDER ||
    'gemini,groq,openrouter,huggingface,anthropic,openai,xai'
  )
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);

  if (!preferred) {
    return configured;
  }

  const preferredList =
    preferred === 'xai'
      ? ['xai', 'groq']
      : preferred === 'openai'
      ? ['openai']
      : [preferred];

  return [
    ...preferredList,
    ...configured.filter(provider => !preferredList.includes(provider)),
  ];
};

const providerConfigs = () => ({
  gemini: {
    enabled: Boolean(process.env.GEMINI_API_KEY),
    label: 'Gemini',
    fn: askGemini,
  },
  openai: {
    enabled: Boolean(process.env.OPENAI_API_KEY),
    label: 'OpenAI',
    fn: askOpenAI,
  },
  anthropic: {
    enabled: Boolean(process.env.ANTHROPIC_API_KEY),
    label: 'Claude',
    fn: askAnthropic,
  },
  groq: {
    enabled: Boolean(process.env.GROQ_API_KEY),
    label: 'GroqCloud',
    fn: askGroq,
  },
  huggingface: {
    enabled: Boolean(process.env.HF_API_KEY || process.env.HUGGINGFACE_API_KEY),
    label: 'Hugging Face',
    fn: askHuggingFace,
  },
  openrouter: {
    enabled: Boolean(process.env.OPENROUTER_API_KEY),
    label: 'OpenRouter',
    fn: askOpenRouter,
  },
  xai: {
    enabled: Boolean(process.env.XAI_API_KEY),
    label: 'Grok',
    fn: askXai,
  },
});

const tokenLimit = value => Math.max(256, Math.min(Number(value) || 2048, 8192));

async function askGemini({history, systemPrompt, maxTokens}) {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';
  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    `${model}:generateContent?key=${key}`;
  const {data} = await axios.post(
    url,
    {
      system_instruction: {
        parts: [{text: cleanText(systemPrompt) || defaultSystem}],
      },
      contents: buildGeminiHistory(history),
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: tokenLimit(maxTokens),
        topP: 0.95,
      },
      safetySettings: [
        {category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE'},
        {category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE'},
        {category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE'},
        {category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE'},
      ],
    },
    {timeout: Number(process.env.AI_TIMEOUT_MS || 30000)},
  );
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('AI response empty');
  }
  return text;
}

async function askOpenAI({history, systemPrompt, maxTokens}) {
  const {data} = await axios.post(
    process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions',
    {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: chatMessages({history, systemPrompt}),
      temperature: 0.85,
      max_tokens: tokenLimit(maxTokens),
    },
    {
      timeout: Number(process.env.AI_TIMEOUT_MS || 30000),
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    },
  );
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('AI response empty');
  }
  return text;
}

async function askAnthropic({history, systemPrompt, maxTokens}) {
  const messages = normalizeHistory(history);
  const {data} = await axios.post(
    process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1/messages',
    {
      model: process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307',
      system: cleanText(systemPrompt) || defaultSystem,
      messages: messages.length ? messages : [{role: 'user', content: 'Hello'}],
      temperature: 0.85,
      max_tokens: tokenLimit(maxTokens),
    },
    {
      timeout: Number(process.env.AI_TIMEOUT_MS || 30000),
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': process.env.ANTHROPIC_VERSION || '2023-06-01',
        'Content-Type': 'application/json',
      },
    },
  );
  const text = data.content?.find(part => part.type === 'text')?.text;
  if (!text) {
    throw new Error('AI response empty');
  }
  return text;
}

async function askGroq({history, systemPrompt, maxTokens}) {
  const {data} = await axios.post(
    process.env.GROQ_BASE_URL ||
      'https://api.groq.com/openai/v1/chat/completions',
    {
      model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
      messages: chatMessages({history, systemPrompt}),
      temperature: 0.85,
      max_tokens: tokenLimit(maxTokens),
    },
    {
      timeout: Number(process.env.AI_TIMEOUT_MS || 30000),
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
    },
  );
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('AI response empty');
  }
  return text;
}

async function askHuggingFace({history, systemPrompt, maxTokens}) {
  const token = process.env.HF_API_KEY || process.env.HUGGINGFACE_API_KEY;
  const {data} = await axios.post(
    process.env.HF_BASE_URL ||
      'https://router.huggingface.co/v1/chat/completions',
    {
      model: process.env.HF_MODEL || 'Qwen/Qwen2.5-7B-Instruct-1M',
      messages: chatMessages({history, systemPrompt}),
      temperature: 0.85,
      max_tokens: tokenLimit(maxTokens),
    },
    {
      timeout: Number(process.env.AI_TIMEOUT_MS || 30000),
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('AI response empty');
  }
  return text;
}

async function askOpenRouter({history, systemPrompt, maxTokens}) {
  const {data} = await axios.post(
    process.env.OPENROUTER_BASE_URL ||
      'https://openrouter.ai/api/v1/chat/completions',
    {
      model: process.env.OPENROUTER_MODEL || 'openrouter/free',
      messages: chatMessages({history, systemPrompt}),
      temperature: 0.85,
      max_tokens: tokenLimit(maxTokens),
    },
    {
      timeout: Number(process.env.AI_TIMEOUT_MS || 30000),
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.PUBLIC_BACKEND_URL || 'https://vertex.ai',
        'X-Title': 'Vertex AI',
      },
    },
  );
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('AI response empty');
  }
  return text;
}

async function askXai({history, systemPrompt, maxTokens}) {
  const {data} = await axios.post(
    process.env.XAI_BASE_URL || 'https://api.x.ai/v1/chat/completions',
    {
      model: process.env.XAI_MODEL || 'grok-2-latest',
      messages: chatMessages({history, systemPrompt}),
      temperature: 0.85,
      max_tokens: tokenLimit(maxTokens),
    },
    {
      timeout: Number(process.env.AI_TIMEOUT_MS || 30000),
      headers: {
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    },
  );
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('AI response empty');
  }
  return text;
}

async function askAI({history, systemPrompt, provider, maxTokens}) {
  const configs = providerConfigs();
  const attempts = [];
  for (const providerName of providerOrder(provider)) {
    const config = configs[providerName];
    if (!config?.enabled) {
      continue;
    }
    try {
      const reply = await config.fn({history, systemPrompt, maxTokens});
      console.log(`AI provider selected: ${config.label}`);
      return reply;
    } catch (error) {
      const info = axiosErrorInfo(error);
      attempts.push(`${config.label}: ${info.status || 'ERR'} ${info.message}`);
      console.warn(`AI provider failed: ${config.label} - ${info.message}`);
      if (!shouldFailover(error)) {
        continue;
      }
    }
  }

  if (!attempts.length) {
    return localFallback(history);
  }

  console.error('All AI providers failed:', attempts.join(' | '));
  return localFallback(history);
}

module.exports = {askAI};
