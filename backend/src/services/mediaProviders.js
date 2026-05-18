const {askAI} = require('./aiRouter');

const pollinationsBaseUrl =
  process.env.POLLINATIONS_IMAGE_URL || 'https://image.pollinations.ai/prompt';

const imageProviders = [
  {
    id: 'pollinations',
    label: 'Pollinations.ai',
    category: 'image',
    free: true,
    keyEnv: null,
    status: 'ready',
    note: 'No key required. Direct image URL generation.',
  },
  {
    id: 'huggingface',
    label: 'Hugging Face',
    category: 'image',
    free: true,
    keyEnv: 'HF_API_KEY',
    status: 'configurable',
    note: 'Use for open-source image models when a model endpoint is selected.',
  },
  {
    id: 'fal',
    label: 'Fal.ai',
    category: 'image',
    free: false,
    keyEnv: 'FAL_KEY',
    status: 'configurable',
    note: 'Trial credits/provider key required.',
  },
  {
    id: 'together',
    label: 'Together AI',
    category: 'image',
    free: false,
    keyEnv: 'TOGETHER_API_KEY',
    status: 'configurable',
    note: 'Trial credits/provider key required.',
  },
  {
    id: 'deepai',
    label: 'DeepAI',
    category: 'image',
    free: true,
    keyEnv: 'DEEPAI_API_KEY',
    status: 'configurable',
    note: 'Simple text-to-image API when key is configured.',
  },
  {
    id: 'prodia',
    label: 'Prodia',
    category: 'image',
    free: true,
    keyEnv: 'PRODIA_API_KEY',
    status: 'configurable',
    note: 'Stable Diffusion API key required.',
  },
  {
    id: 'limewire',
    label: 'LimeWire Developer',
    category: 'image',
    free: true,
    keyEnv: 'LIMEWIRE_API_KEY',
    status: 'configurable',
    note: 'Daily credits/key required.',
  },
  {
    id: 'monster',
    label: 'Monster API',
    category: 'image',
    free: true,
    keyEnv: 'MONSTER_API_KEY',
    status: 'configurable',
    note: 'Monthly credits/key required.',
  },
];

const videoProviders = [
  {
    id: 'google-veo',
    label: 'Google AI Studio / Veo',
    category: 'video',
    free: true,
    keyEnv: 'GOOGLE_AI_API_KEY',
    status: 'configurable',
    note: 'Use when Veo API access is enabled on your Google account.',
  },
  {
    id: 'zsky',
    label: 'ZSky AI Video',
    category: 'video',
    free: true,
    keyEnv: 'ZSKY_API_KEY',
    status: 'configurable',
    note: 'REST provider key/base URL required.',
  },
  {
    id: 'kling',
    label: 'Kling AI',
    category: 'video',
    free: true,
    keyEnv: 'KLING_API_KEY',
    status: 'configurable',
    note: 'Developer credits/key required.',
  },
  {
    id: 'huggingface-video',
    label: 'Hugging Face Video',
    category: 'video',
    free: true,
    keyEnv: 'HF_API_KEY',
    status: 'configurable',
    note: 'Open-source text-to-video models can be attached here.',
  },
  {
    id: 'fal-video',
    label: 'Fal.ai Video',
    category: 'video',
    free: false,
    keyEnv: 'FAL_KEY',
    status: 'configurable',
    note: 'Trial credits/provider key required.',
  },
  {
    id: 'leonardo',
    label: 'Leonardo.ai',
    category: 'video',
    free: false,
    keyEnv: 'LEONARDO_API_KEY',
    status: 'configurable',
    note: 'API credits/key required.',
  },
  {
    id: 'json2video',
    label: 'JSON2Video',
    category: 'video',
    free: true,
    keyEnv: 'JSON2VIDEO_API_KEY',
    status: 'configurable',
    note: 'Best for automated videos, overlays, captions, and templates.',
  },
  {
    id: 'monster-video',
    label: 'Monster API Video',
    category: 'video',
    free: true,
    keyEnv: 'MONSTER_API_KEY',
    status: 'configurable',
    note: 'Monthly credits/key required.',
  },
];

const ratioSize = ratio => {
  const normalized = String(ratio || '').toLowerCase();
  if (normalized.includes('portrait') || normalized.includes('9:16')) {
    return {width: 768, height: 1365, ratio: 'portrait'};
  }
  if (
    normalized.includes('landscape') ||
    normalized.includes('wide') ||
    normalized.includes('16:9')
  ) {
    return {width: 1365, height: 768, ratio: 'landscape'};
  }
  return {width: 1024, height: 1024, ratio: 'square'};
};

const isConfigured = provider =>
  !provider.keyEnv || Boolean(process.env[provider.keyEnv]);

const providerStatus = provider => ({
  ...provider,
  configured: isConfigured(provider),
  keyEnv: provider.keyEnv || '',
});

const listMediaProviders = () => ({
  image: imageProviders.map(providerStatus),
  video: videoProviders.map(providerStatus),
});

const cleanPrompt = value => String(value || '').replace(/\s+/g, ' ').trim();

const imageUrlForPrompt = ({prompt, ratio, width, height}) => {
  const size = width && height ? {width, height} : ratioSize(ratio);
  return `${pollinationsBaseUrl}/${encodeURIComponent(
    cleanPrompt(prompt),
  )}?width=${size.width}&height=${size.height}&nologo=true&enhance=true`;
};

const generateImage = ({
  prompt,
  style = 'No Style',
  ratio = 'square',
  provider = 'pollinations',
}) => {
  const finalPrompt = [
    cleanPrompt(prompt),
    style && style !== 'No Style' ? `Style: ${style}` : '',
  ]
    .filter(Boolean)
    .join('. ');
  if (!finalPrompt) {
    throw new Error('Prompt required');
  }
  const size = ratioSize(ratio);
  return {
    type: 'image',
    title: 'Image Generator',
    provider: provider || 'pollinations',
    prompt: finalPrompt,
    url: imageUrlForPrompt({
      prompt: finalPrompt,
      ratio,
      width: size.width,
      height: size.height,
    }),
    width: size.width,
    height: size.height,
    ratio: size.ratio,
  };
};

const videoSystemPrompt = `You are vertex.ai video generation mode.
Create practical video generation packages for external APIs.
Never claim the final MP4 is rendered unless a video URL is provided.
Return concise markdown with: concept, script, storyboard, shot prompts, camera movement, sound/music direction, and provider-ready prompts.`;

const generateVideoPackage = async ({
  prompt,
  style = 'Cinematic',
  duration = '30s',
  provider = 'vertex',
}) => {
  const finalPrompt = cleanPrompt(prompt);
  if (!finalPrompt) {
    throw new Error('Prompt required');
  }

  const output = await askAI({
    history: [
      {
        role: 'user',
        content: `Create a ${duration} ${style} AI video package for:\n${finalPrompt}\n\nAlso include prompts for Google Veo, Kling, Hugging Face text-to-video, Fal/LTX, JSON2Video overlays, and Runway/Pika-style tools.`,
      },
    ],
    systemPrompt: videoSystemPrompt,
    provider,
    maxTokens: 2600,
  });

  return {
    type: 'video',
    title: 'Video Generator',
    provider: 'vertex-video-plan',
    prompt: finalPrompt,
    output,
    providers: listMediaProviders().video,
  };
};

module.exports = {
  generateImage,
  generateVideoPackage,
  imageUrlForPrompt,
  listMediaProviders,
  ratioSize,
};
