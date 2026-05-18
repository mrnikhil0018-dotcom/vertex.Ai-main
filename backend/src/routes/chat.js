const express = require('express');
const auth = require('../middleware/auth');
const {askAI} = require('../services/aiRouter');
const {createChat, listChats} = require('../services/supabaseDb');
const {runChatTool} = require('../services/toolRouter');
const {
  buildProjectPrompt,
  buildProjectRefinePrompt,
  buildToolRefinePrompt,
  projectSystemPrompt,
} = require('../services/projectBuilder');
const {
  generateImage,
  generateVideoPackage,
  listMediaProviders,
} = require('../services/mediaProviders');

const router = express.Router();

router.get('/chats', auth, async (req, res) => {
  const chats = await listChats(req.user.id);
  res.json({chats});
});

router.get('/media/providers', auth, (req, res) => {
  res.json(listMediaProviders());
});

router.post('/chat', auth, async (req, res) => {
  try {
    const history = Array.isArray(req.body.history) ? req.body.history : [];
    const systemPrompt = req.body.systemPrompt || '';
    const provider = req.body.provider || 'vertex';
    const toolResult = await runChatTool({history, systemPrompt, provider});
    const reply =
      toolResult?.reply || (await askAI({history, systemPrompt, provider}));
    const messages = [
      ...history.map(item => ({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: String(item.content || ''),
        time: item.time || '',
        tool: item.tool || undefined,
      })),
      {
        role: 'assistant',
        content: reply,
        time: new Date().toLocaleTimeString(),
        tool: toolResult?.tool,
      },
    ];
    const firstUser =
      messages.find(item => item.role === 'user')?.content || 'Chat';
    await createChat({
      userId: req.user.id,
      preview: firstUser.slice(0, 60),
      messages,
    });
    res.json({reply, tool: toolResult?.tool || null});
  } catch (error) {
    res.status(500).json({message: error.message});
  }
});

router.post('/tools/generate', auth, async (req, res) => {
  try {
    const type = String(req.body.type || '').toLowerCase();
    if (type === 'image') {
      return res.json({
        output: '',
        tool: generateImage({
          prompt: req.body.prompt || req.body.description || '',
          style: req.body.style || req.body.imageStyle || 'No Style',
          ratio: req.body.ratio || 'square',
        }),
      });
    }
    if (type === 'video' && req.body.render === true) {
      const video = await generateVideoPackage({
        prompt: req.body.prompt || req.body.description || '',
        style: req.body.style || req.body.videoStyle || 'Cinematic',
        duration: req.body.duration || '30s',
        provider: req.body.provider || 'vertex',
      });
      return res.json({output: video.output, tool: video});
    }
    const isProject = ['website', 'app'].includes(type);
    const isRefine = req.body.action === 'refine';
    const prompt = isRefine
      ? isProject
        ? buildProjectRefinePrompt({
            type,
            currentOutput: req.body.currentOutput || '',
            instruction: req.body.instruction || req.body.prompt || '',
          })
        : buildToolRefinePrompt({
            type: type || 'tool',
            currentOutput: req.body.currentOutput || '',
            instruction: req.body.instruction || req.body.prompt || '',
          })
      : isProject
      ? buildProjectPrompt({
          type,
          description: req.body.description || req.body.prompt || '',
          subtype: req.body.subtype || '',
          theme: req.body.theme || '',
        })
      : req.body.prompt || '';
    if (!prompt.trim()) {
      return res.status(400).json({message: 'Prompt required'});
    }
    const output = await askAI({
      history: [{role: 'user', content: prompt}],
      systemPrompt:
        isProject
          ? projectSystemPrompt
          : 'You are vertex.ai tools mode. Return practical, polished output. Use markdown and include complete code when asked.',
      provider: req.body.provider || 'vertex',
      maxTokens: isProject ? 7000 : 2048,
    });
    res.json({output});
  } catch (error) {
    res.status(500).json({message: error.message});
  }
});

module.exports = router;
