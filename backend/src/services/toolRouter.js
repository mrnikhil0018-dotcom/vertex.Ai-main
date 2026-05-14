const {askAI} = require('./aiRouter');
const {
  buildProjectPrompt,
  projectSystemPrompt,
} = require('./projectBuilder');

const ratioSize = ratio => {
  if (ratio === 'portrait') {
    return {width: 768, height: 1365};
  }
  if (ratio === 'landscape') {
    return {width: 1365, height: 768};
  }
  return {width: 1024, height: 1024};
};

const imageUrlForPrompt = ({prompt, ratio = 'square'}) => {
  const {width, height} = ratioSize(ratio);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(
    prompt,
  )}?width=${width}&height=${height}&nologo=true&enhance=true`;
};

const latestUserText = history =>
  [...(Array.isArray(history) ? history : [])]
    .reverse()
    .find(message => message.role !== 'assistant')?.content || '';

const includesAny = (text, words) => words.some(word => text.includes(word));

const detectToolIntent = text => {
  const lower = String(text || '').toLowerCase();
  const wantsCreate =
    /generate|create|make|build|write|banao|bana|banado|do|de|taiyar|likho|likh/.test(
      lower,
    );

  if (
    wantsCreate &&
    includesAny(lower, [
      'image',
      'photo',
      'picture',
      'poster',
      'logo',
      'thumbnail',
      'wallpaper',
      'tasveer',
      'tस्वीर',
      'फोटो',
      'pic',
    ])
  ) {
    return 'image';
  }

  if (
    wantsCreate &&
    includesAny(lower, [
      'website',
      'web site',
      'landing page',
      'portfolio',
      'business site',
      'html page',
      'webpage',
    ])
  ) {
    return 'website';
  }

  if (
    wantsCreate &&
    includesAny(lower, [
      'app',
      'application',
      'todo',
      'calculator',
      'notes app',
      'habit tracker',
      'budget tracker',
      'dashboard app',
    ])
  ) {
    return 'app';
  }

  if (
    wantsCreate &&
    includesAny(lower, [
      'video',
      'reel',
      'shorts',
      'storyboard',
      'shot list',
      'runway',
      'pika',
      'kling',
    ])
  ) {
    return 'video';
  }

  if (
    wantsCreate &&
    includesAny(lower, [
      'music',
      'song',
      'lyrics',
      'suno',
      'udio',
      'chord',
      'beat',
      'rap',
      'bollywood song',
    ])
  ) {
    return 'music';
  }

  if (
    wantsCreate &&
    includesAny(lower, [
      'code',
      'program',
      'script',
      'debug',
      'fix code',
      'python',
      'javascript',
      'java ',
      'c++',
      'sql',
    ])
  ) {
    return 'code';
  }

  if (
    wantsCreate &&
    includesAny(lower, [
      'essay',
      'email',
      'blog',
      'caption',
      'cover letter',
      'story',
      'summary',
      'speech',
      'article',
    ])
  ) {
    return 'writing';
  }

  return null;
};

const typeTitles = {
  image: 'Image Generator',
  website: 'Website Builder',
  app: 'App Builder',
  video: 'Video Generator',
  music: 'Music Generator',
  code: 'Code Writer',
  writing: 'Writing Tool',
};

const promptForTool = (type, userText) => {
  const prompts = {
    website: buildProjectPrompt({
      type: 'website',
      description: userText,
      subtype: 'website',
      theme: 'modern',
    }),
    app: buildProjectPrompt({
      type: 'app',
      description: userText,
      subtype: 'mobile app',
      theme: 'modern',
    }),
    video: `Create an AI video package for this request:\n\n${userText}\n\nReturn concept, script, storyboard table, shot-by-shot prompts, camera motion, music direction, and prompts for Kling, Runway, and Pika.`,
    music: `Create music content for this request:\n\n${userText}\n\nReturn lyrics or music prompt as appropriate, genre/mood notes, Suno/Udio prompt, chord ideas, and arrangement direction.`,
    code: `Handle this code request:\n\n${userText}\n\nReturn clean code, explanation, edge cases, and usage notes.`,
    writing: `Create the requested writing output:\n\n${userText}\n\nReturn polished, ready-to-use text with a clear structure.`,
  };
  return prompts[type] || userText;
};

const responseIntro = type => {
  const intros = {
    image: 'Image generate ho gayi. Preview neeche hai.',
    website: 'Website build draft ready hai. Code neeche diya hai.',
    app: 'App build draft ready hai. Code/output neeche hai.',
    video: 'Video plan ready hai. Script aur storyboard neeche hai.',
    music: 'Music output ready hai. Lyrics/prompt neeche hai.',
    code: 'Code output ready hai.',
    writing: 'Writing draft ready hai.',
  };
  return intros[type] || 'Output ready hai.';
};

async function runChatTool({history, systemPrompt, provider}) {
  const userText = latestUserText(history);
  const type = detectToolIntent(userText);
  if (!type) {
    return null;
  }

  if (type === 'image') {
    const ratio = /portrait|9:16|mobile|story|vertical/i.test(userText)
      ? 'portrait'
      : /landscape|16:9|wide|banner|youtube/i.test(userText)
      ? 'landscape'
      : 'square';
    const prompt = userText
      .replace(
        /generate|create|make|banao|banado|image|photo|picture|tasveer|mujhe|karke|kar ke|please|do/gi,
        '',
      )
      .replace(/\s+/g, ' ')
      .trim();
    const finalPrompt =
      prompt ||
      'A premium futuristic AI assistant scene, dark background, cyan and gold light, highly detailed 3D render';
    return {
      reply: responseIntro(type),
      tool: {
        type,
        title: typeTitles[type],
        prompt: finalPrompt,
        url: imageUrlForPrompt({prompt: finalPrompt, ratio}),
        ratio,
      },
    };
  }

  const output = await askAI({
    history: [{role: 'user', content: promptForTool(type, userText)}],
    systemPrompt:
      ['website', 'app'].includes(type)
        ? projectSystemPrompt
        : systemPrompt ||
          'You are vertex.ai tools mode. Return practical, polished output. Never mention the underlying provider. Use markdown and include complete code when asked.',
    provider,
    maxTokens: ['website', 'app'].includes(type) ? 7000 : 2048,
  });

  return {
    reply: responseIntro(type),
    tool: {
      type,
      title: typeTitles[type],
      prompt: userText,
      output,
    },
  };
}

module.exports = {runChatTool};
