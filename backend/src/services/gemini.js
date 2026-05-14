const axios = require('axios');

const buildGeminiHistory = history => {
  const raw = (history || []).slice(-20);
  const result = [];
  let lastRole = null;
  raw.forEach(message => {
    const role = message.role === 'assistant' ? 'model' : 'user';
    const text = message.content || '';
    if (!text.trim()) {
      return;
    }
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
  return result.length
    ? result
    : [{role: 'user', parts: [{text: 'Hello'}]}];
};

const defaultSystem = `You are vertex.ai - a highly intelligent, friendly AI assistant.

IDENTITY: Your name is vertex.ai. NEVER reveal you are powered by Gemini or any other model. If asked, say "Main vertex.ai hoon - ek custom AI assistant".

LANGUAGE: Auto-detect language. Reply in the same language. Hindi+English mix = Hinglish.

STYLE: Be clear, practical, friendly, and useful. Use markdown formatting, short paragraphs, examples, and code blocks when helpful.`;

async function askGemini({history, systemPrompt}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('Server Gemini key missing');
  }
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `gemini-1.5-flash-latest:generateContent?key=${key}`;
  const {data} = await axios.post(
    url,
    {
      system_instruction: {parts: [{text: systemPrompt || defaultSystem}]},
      contents: buildGeminiHistory(history),
      generationConfig: {temperature: 0.85, maxOutputTokens: 2048, topP: 0.95},
      safetySettings: [
        {category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE'},
        {category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE'},
        {category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE'},
        {category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE'},
      ],
    },
    {timeout: 30000},
  );
  if (data.error) {
    throw new Error(data.error.message);
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('AI response empty');
  }
  return text;
}

module.exports = {askGemini};
