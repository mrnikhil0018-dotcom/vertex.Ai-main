import RNFS from 'react-native-fs';

const stripFence = value => {
  const text = String(value || '').trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return (fenced?.[1] || text).trim();
};

const extractJsonText = value => {
  const text = stripFence(value);
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) {
    return text.slice(first, last + 1);
  }
  return text;
};

export const parseProjectOutput = value => {
  try {
    const parsed = JSON.parse(extractJsonText(value));
    if (!parsed || !Array.isArray(parsed.files)) {
      return null;
    }
    return {
      ...parsed,
      type: parsed.type || 'project',
      projectName: parsed.projectName || 'vertex-project',
      summary: parsed.summary || '',
      previewHtml: parsed.previewHtml || '',
      files: parsed.files
        .map(file => ({
          path: String(file.path || 'file.txt'),
          language: String(file.language || ''),
          content: String(file.content || ''),
        }))
        .filter(file => file.path && file.content),
      runCommands: Array.isArray(parsed.runCommands)
        ? parsed.runCommands.map(String)
        : [],
      testPlan: Array.isArray(parsed.testPlan)
        ? parsed.testPlan.map(String)
        : [],
      debugChecklist: Array.isArray(parsed.debugChecklist)
        ? parsed.debugChecklist.map(String)
        : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes.map(String) : [],
    };
  } catch {
    return null;
  }
};

export const safeProjectName = value =>
  String(value || 'vertex-project')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'vertex-project';

export const safeRelativePath = value => {
  const cleaned = String(value || 'file.txt')
    .replace(/\\/g, '/')
    .split('/')
    .filter(part => part && part !== '.' && part !== '..')
    .join('/');
  return cleaned || 'file.txt';
};

export const escapeHtml = value =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const extractPreviewHtml = value => {
  const project = parseProjectOutput(value);
  if (project?.previewHtml) {
    return project.previewHtml;
  }
  const htmlFile = project?.files?.find(file =>
    /(^|\/)(preview|index)\.html$/i.test(file.path),
  );
  if (htmlFile?.content) {
    return htmlFile.content;
  }

  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  const htmlFence =
    text.match(/```(?:html|htm)[^\n]*\n([\s\S]*?)```/i) ||
    text.match(/```[^\n]*(?:index\.html|preview\.html)[^\n]*\n([\s\S]*?)```/i);
  const candidate = (htmlFence?.[1] || text).trim();
  if (/<!doctype html|<html[\s>]/i.test(candidate)) {
    return candidate;
  }
  if (/<body[\s>]|<main[\s>]|<section[\s>]|<style[\s>]/i.test(candidate)) {
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body>${candidate}</body></html>`;
  }
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" /><style>body{margin:0;background:#050507;color:#f0f2ff;font-family:Arial,sans-serif;padding:20px;line-height:1.55}pre{white-space:pre-wrap;background:#0d0f16;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:16px}</style></head><body><pre>${escapeHtml(
    candidate,
  )}</pre></body></html>`;
};

export const projectToText = project => {
  if (!project) {
    return '';
  }
  const files = project.files
    .map(file => `--- ${file.path} ---\n${file.content}`)
    .join('\n\n');
  return [
    `${project.projectName || 'Vertex project'}`,
    project.summary || '',
    project.runCommands?.length
      ? `Run commands:\n${project.runCommands.join('\n')}`
      : '',
    files,
  ]
    .filter(Boolean)
    .join('\n\n');
};

const ensureDir = async path => {
  const exists = await RNFS.exists(path);
  if (!exists) {
    await RNFS.mkdir(path);
  }
};

const writeFilesAtBase = async (basePath, project) => {
  await ensureDir(basePath);
  for (const file of project.files) {
    const relative = safeRelativePath(file.path);
    const target = `${basePath}/${relative}`;
    const folder = target.split('/').slice(0, -1).join('/');
    await ensureDir(folder);
    await RNFS.writeFile(target, file.content, 'utf8');
  }
  if (project.previewHtml) {
    await RNFS.writeFile(
      `${basePath}/preview.html`,
      project.previewHtml,
      'utf8',
    );
  }
  await RNFS.writeFile(
    `${basePath}/vertex-project.json`,
    JSON.stringify(project, null, 2),
    'utf8',
  );
};

export const writeProjectToDownloads = async project => {
  const folderName = `${safeProjectName(project?.projectName)}-${Date.now()}`;
  const bases = [
    RNFS.DownloadDirectoryPath
      ? `${RNFS.DownloadDirectoryPath}/${folderName}`
      : '',
    `${RNFS.DocumentDirectoryPath}/${folderName}`,
  ].filter(Boolean);

  let lastError;
  for (const base of bases) {
    try {
      await writeFilesAtBase(base, project);
      return base;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Project save failed');
};
