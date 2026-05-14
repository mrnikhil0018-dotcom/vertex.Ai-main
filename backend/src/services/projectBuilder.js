const baseDeploySteps = {
  netlify: [
    'npm install',
    'npm run build',
    'Drag the dist folder to Netlify, or connect the GitHub repo.',
    'One-click deploy needs NETLIFY_AUTH_TOKEN stored only on the backend.',
  ],
  vercel: [
    'npm install',
    'npm run build',
    'Import the project in Vercel and keep the framework as Vite/React.',
    'One-click deploy needs VERCEL_TOKEN stored only on the backend.',
  ],
  githubPages: [
    'Push the generated files to GitHub.',
    'Enable GitHub Pages from repository settings.',
    'Use the included workflow to build and publish the site.',
  ],
};

const jsonRules = `Return ONLY valid JSON. Do not wrap the response in markdown fences.
Do not add explanation outside JSON. Escape newlines inside file content correctly.
Every file must contain complete working code. No placeholder comments like "add logic here".
Use practical, polished UI copy and realistic sample data.
Keep the output concise enough to fit in one response but complete enough to run.`;

const websiteFileRules = `Required files:
- package.json with Vite scripts: dev, build, preview
- index.html
- src/main.jsx
- src/App.jsx
- src/styles.css
- src/data.js if sample data helps
- netlify.toml
- vercel.json
- .github/workflows/deploy.yml
- README.md with setup, preview, build, and deploy steps`;

const appFileRules = `Required React Native project files:
- package.json with React Native scripts
- index.js
- App.js
- src/screens/HomeScreen.js
- src/components/* when useful
- src/data.js or src/utils.js when useful
- README.md with setup, Android debug/release build steps
Also include a browser preview in previewHtml so the mobile app can preview the UI inside WebView.`;

const schema = type => `JSON schema:
{
  "type": "${type}",
  "projectName": "short-kebab-case-name",
  "summary": "one short paragraph",
  "previewHtml": "complete single-file preview HTML with CSS and JS",
  "files": [
    {"path": "package.json", "language": "json", "content": "...complete file content..."}
  ],
  "runCommands": ["npm install", "npm run dev", "npm run build"],
  "deploy": ${JSON.stringify(baseDeploySteps)},
  "testPlan": ["manual test case 1", "manual test case 2"],
  "debugChecklist": ["likely issue and fix 1", "likely issue and fix 2"],
  "notes": ["short note"]
}`;

const buildWebsitePrompt = ({description, subtype, theme}) => `You are vertex.ai Website Builder, like Lovable/Codex for complete front-end projects.

Build a complete ${theme || 'modern'} ${subtype || 'website'} for:
${description}

${jsonRules}
${schema('website')}

Website requirements:
- Use React + Vite for the project files.
- Include HTML, CSS, and JavaScript/React code needed to run.
- previewHtml must be a full standalone <!doctype html> file with <style> and <script>.
- Responsive mobile/tablet/desktop layout.
- Real sections, real copy, sample data, forms/interactions, validation, empty/loading/error states where useful.
- Polished design, accessible labels, keyboard-friendly controls.
${websiteFileRules}`;

const buildAppPrompt = ({description, subtype, theme}) => `You are vertex.ai App Builder, like Lovable/Codex for complete app prototypes.

Build a complete ${theme || 'modern'} ${subtype || 'mobile'} app for:
${description}

${jsonRules}
${schema('mobile-app')}

App requirements:
- Use React Native JavaScript for the actual app files.
- Include state management, sample data, validation, useful actions, and local persistence guidance where useful.
- previewHtml must be a full standalone browser prototype that mirrors the mobile app UI.
- Include Android debug/release build notes in README.md.
- Mobile-first UI with loading, empty, error, and success states.
${appFileRules}`;

const buildProjectPrompt = ({type, description, subtype, theme}) => {
  if (type === 'app') {
    return buildAppPrompt({description, subtype, theme});
  }
  return buildWebsitePrompt({description, subtype, theme});
};

const buildProjectRefinePrompt = ({type, currentOutput, instruction}) => {
  const finalType = type === 'app' ? 'mobile-app' : 'website';
  return `You are vertex.ai project editor. Update an existing generated project.

User change request:
${instruction}

Existing project JSON:
${currentOutput}

${jsonRules}
${schema(finalType)}

Editing rules:
- Return the full updated project JSON, not a diff.
- Preserve useful existing files, projectName, deploy steps, and run commands unless the user asks to change them.
- Update previewHtml so the in-app preview reflects the requested change.
- Update every affected file consistently.
- If the request is vague, make the smallest sensible improvement.
- No markdown fences, no explanation outside JSON.`;
};

const buildToolRefinePrompt = ({type, currentOutput, instruction}) => `You are vertex.ai ${type} editor.

User wants this change:
${instruction}

Current ${type} output:
${currentOutput}

Return the complete updated ${type} output. Do not return only a diff.
Keep useful existing details, fix the requested part, and make the result ready to use.
Never mention the underlying AI provider.`;

const projectSystemPrompt =
  'You are vertex.ai project builder. You output complete runnable project files as strict JSON only. Never mention underlying AI providers.';

module.exports = {
  buildProjectPrompt,
  buildProjectRefinePrompt,
  buildToolRefinePrompt,
  projectSystemPrompt,
};
