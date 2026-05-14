import React, {useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {WebView} from 'react-native-webview';
import RNFS from 'react-native-fs';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  Code2,
  Copy,
  Download,
  Film,
  Globe2,
  Image as ImageIcon,
  Music,
  PenLine,
  Play,
  Send,
  Shuffle,
  Smartphone,
  Wand2,
  X,
} from 'lucide-react-native';
import {generateToolContent, imageUrlForPrompt} from '../services/api';
import {emitEvent} from '../utils/events';
import {
  extractPreviewHtml,
  parseProjectOutput,
  projectToText,
  writeProjectToDownloads,
} from '../utils/projectOutput';
import {COLORS, FONT, GRADIENTS, radius, shadow} from '../utils/theme';

const tabs = [
  {
    id: 'image',
    label: 'Image',
    title: 'Image Generator',
    badge: 'FREE',
    Icon: ImageIcon,
  },
  {
    id: 'video',
    label: 'Video',
    title: 'Video Generator',
    badge: 'Beta',
    Icon: Film,
  },
  {
    id: 'code',
    label: 'Code',
    title: 'Code Writer & Debugger',
    badge: 'FREE',
    Icon: Code2,
  },
  {
    id: 'website',
    label: 'Website',
    title: 'Website Builder',
    badge: 'FREE',
    Icon: Globe2,
  },
  {
    id: 'app',
    label: 'App',
    title: 'App Builder',
    badge: 'FREE',
    Icon: Smartphone,
  },
  {
    id: 'writing',
    label: 'Writing',
    title: 'Writing Tools',
    badge: 'FREE',
    Icon: PenLine,
  },
  {
    id: 'music',
    label: 'Music',
    title: 'Music Generator',
    badge: 'Beta',
    Icon: Music,
  },
];

const randomPrompts = [
  'A futuristic Pune skyline with neon monsoon reflections and a friendly AI hologram',
  'A cozy dark-mode study desk, glowing laptop, coffee, and coding notes in cinematic light',
  'A cyberpunk Indian street market with floating screens and rain-soaked colors',
  'A minimal 3D robot assistant made of glass, gold, and cyan light',
  'A fantasy library inside a spaceship, ancient books and holographic constellations',
];

const optionSets = {
  imageStyle: [
    'No Style',
    'Photorealistic',
    'Digital Art',
    'Anime',
    'Oil Painting',
    '3D Render',
    'Cyberpunk',
    'Minimalist',
    'Watercolor',
  ],
  ratio: ['Square 1:1', 'Landscape 16:9', 'Portrait 9:16', 'Wide 16:9 HD'],
  videoStyle: [
    'Cinematic',
    'Animated',
    'Documentary',
    'Product Demo',
    'Social Media Reel',
    'Music Video',
  ],
  duration: ['15s', '30s', '60s', '2min'],
  language: [
    'Python',
    'JavaScript',
    'Java',
    'C++',
    'C#',
    'PHP',
    'TypeScript',
    'Swift',
    'Kotlin',
    'Go',
    'Rust',
    'HTML-CSS',
    'SQL',
    'Dart-Flutter',
  ],
  codeAction: [
    'Write Code',
    'Debug & Fix',
    'Explain Code',
    'Optimize',
    'Convert Language',
    'Add Comments',
  ],
  siteType: [
    'Portfolio',
    'Landing Page',
    'Business Site',
    'Blog',
    'Restaurant',
    'E-Commerce',
    'App Landing',
    'Personal Brand',
  ],
  appType: [
    'Todo/Task',
    'Calculator',
    'Notes',
    'Timer',
    'Quiz',
    'Budget Tracker',
    'Habit Tracker',
    'Weather UI',
    'Chat UI',
    'Dashboard',
    'Custom',
  ],
  theme: ['Dark', 'Light', 'Colorful', 'Minimal'],
  appTheme: ['Dark', 'Light', 'Colorful'],
  writeType: [
    'Essay/Article',
    'Professional Email',
    'Blog Post',
    'Short Story',
    'Social Media Caption',
    'Cover Letter',
    'Speech/Script',
    'Product Description',
    'Improve My Text',
    'Summarize Text',
  ],
  tone: [
    'Professional',
    'Casual',
    'Formal',
    'Creative',
    'Persuasive',
    'Humorous',
  ],
  length: ['Short 100-200w', 'Medium 300-500w', 'Long 700-1000w'],
  musicType: [
    'Song Lyrics',
    'Chord Progression',
    'Suno/Udio Prompt',
    'Music Description',
  ],
  genre: [
    'Pop',
    'Hip-Hop',
    'Bollywood',
    'Rock',
    'R&B',
    'EDM',
    'Classical',
    'Lofi',
  ],
  mood: ['Happy', 'Sad', 'Energetic', 'Romantic', 'Motivational', 'Chill'],
};

const ratioSize = ratio => {
  if (ratio === 'Portrait 9:16') {
    return {width: 768, height: 1365};
  }
  if (ratio === 'Landscape 16:9' || ratio === 'Wide 16:9 HD') {
    return {width: 1365, height: 768};
  }
  return {width: 1024, height: 1024};
};

const Select = ({label, options, value, onChange}) => (
  <View style={styles.block}>
    <Text style={styles.label}>{label}</Text>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.optionRow}>
      {options.map(option => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.option, active && styles.optionActive]}>
            <Text
              style={[styles.optionText, active && styles.optionTextActive]}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  </View>
);

const TextArea = ({label, mono, ...props}) => (
  <View style={styles.block}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      {...props}
      multiline
      textAlignVertical="top"
      placeholderTextColor="rgba(255,255,255,0.24)"
      style={[styles.textArea, mono && styles.monoInput]}
    />
  </View>
);

const PrimaryButton = ({children, onPress, icon: Icon, disabled}) => (
  <Pressable onPress={onPress} disabled={disabled}>
    <LinearGradient
      colors={GRADIENTS.gold}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
      style={[styles.primary, disabled && {opacity: 0.65}]}>
      {Icon ? <Icon size={17} color="#111" /> : null}
      <Text style={styles.primaryText}>{children}</Text>
    </LinearGradient>
  </Pressable>
);

const SecondaryButton = ({children, onPress, icon: Icon}) => (
  <Pressable onPress={onPress} style={styles.secondary}>
    {Icon ? <Icon size={16} color={COLORS.text} /> : null}
    <Text style={styles.secondaryText}>{children}</Text>
  </Pressable>
);

const Output = ({output, onCopy, onDownload, children}) => {
  if (!output && !children) {
    return null;
  }
  return (
    <View style={styles.outputCard}>
      <View style={styles.outputTop}>
        <Text style={styles.outputTitle}>Output</Text>
        <View style={styles.outputActions}>
          {onCopy ? (
            <Pressable style={styles.smallIcon} onPress={onCopy}>
              <Copy size={14} color={COLORS.soft} />
            </Pressable>
          ) : null}
          {onDownload ? (
            <Pressable style={styles.smallIcon} onPress={onDownload}>
              <Download size={14} color={COLORS.soft} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {children || (
        <Text selectable style={styles.outputText}>
          {output}
        </Text>
      )}
    </View>
  );
};

const ProjectPanel = ({project, onDownload}) => {
  if (!project) {
    return null;
  }
  return (
    <View style={styles.projectCard}>
      <Text style={styles.projectName}>{project.projectName}</Text>
      {project.summary ? (
        <Text style={styles.projectSummary}>{project.summary}</Text>
      ) : null}
      <View style={styles.projectStats}>
        <Text style={styles.projectStat}>{project.files.length} files</Text>
        <Text style={styles.projectStat}>
          {project.type === 'mobile-app' ? 'React Native' : 'React + Vite'}
        </Text>
      </View>
      <View style={styles.fileList}>
        {project.files.slice(0, 8).map(file => (
          <View key={file.path} style={styles.filePill}>
            <Text style={styles.filePillText} numberOfLines={1}>
              {file.path}
            </Text>
          </View>
        ))}
      </View>
      {project.runCommands?.length ? (
        <Text selectable style={styles.commandsText}>
          {project.runCommands.join('\n')}
        </Text>
      ) : null}
      <SecondaryButton icon={Download} onPress={onDownload}>
        Download Project Files
      </SecondaryButton>
    </View>
  );
};

const refinePlaceholders = {
  image: 'e.g. background blue karo, text change karo...',
  video: 'e.g. scene 2 slow motion karo...',
  code: 'e.g. isme dark mode aur validation add karo...',
  website: 'e.g. hero section modern karo, pricing add karo...',
  app: 'e.g. login screen add karo, delete button lagao...',
  writing: 'e.g. tone friendly karo aur short rakho...',
  music: 'e.g. chorus catchy karo, Bollywood feel do...',
};

const RefineChat = ({
  active,
  disabled,
  messages,
  value,
  onChangeText,
  onSubmit,
}) => (
  <View style={styles.refineCard}>
    <Text style={styles.refineTitle}>Refine with chat</Text>
    <Text style={styles.refineSub}>
      Output ko change karne ke liye neeche instruction likho.
    </Text>
    {messages.length ? (
      <View style={styles.refineMessages}>
        {messages.slice(-4).map((message, index) => (
          <View
            key={`${message.role}-${index}-${message.text}`}
            style={[
              styles.refineBubble,
              message.role === 'user'
                ? styles.refineUserBubble
                : styles.refineAiBubble,
            ]}>
            <Text
              style={[
                styles.refineBubbleText,
                message.role === 'user' && styles.refineUserText,
              ]}>
              {message.text}
            </Text>
          </View>
        ))}
      </View>
    ) : null}
    <View style={styles.refineInputRow}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
        multiline
        placeholder={refinePlaceholders[active] || 'Kya change karna hai?'}
        placeholderTextColor="rgba(255,255,255,0.28)"
        style={styles.refineInput}
      />
      <Pressable
        disabled={disabled || !value.trim()}
        onPress={onSubmit}
        style={[
          styles.refineSend,
          (disabled || !value.trim()) && styles.refineSendDisabled,
        ]}>
        {disabled ? (
          <ActivityIndicator color="#111" size="small" />
        ) : (
          <Send size={16} color="#111" fill="#111" />
        )}
      </Pressable>
    </View>
  </View>
);

const ToolsScreen = ({selectedModel = 'vertex', themeMode = 'dark'}) => {
  const [active, setActive] = useState('image');
  const [loading, setLoading] = useState(false);
  const [refining, setRefining] = useState(false);
  const [output, setOutput] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [project, setProject] = useState(null);
  const [refineInput, setRefineInput] = useState('');
  const [refineMessages, setRefineMessages] = useState([]);
  const [form, setForm] = useState({
    imagePrompt: '',
    imageStyle: 'No Style',
    ratio: 'Square 1:1',
    videoPrompt: '',
    videoStyle: 'Cinematic',
    duration: '30s',
    codeText: '',
    language: 'JavaScript',
    codeAction: 'Write Code',
    websiteText: '',
    siteType: 'Landing Page',
    siteTheme: 'Dark',
    appText: '',
    appType: 'Todo/Task',
    appTheme: 'Dark',
    writeText: '',
    writeType: 'Essay/Article',
    tone: 'Professional',
    length: 'Medium 300-500w',
    musicText: '',
    musicType: 'Suno/Udio Prompt',
    genre: 'Bollywood',
    mood: 'Energetic',
  });

  const tab = useMemo(() => tabs.find(item => item.id === active), [active]);

  const update = (key, value) =>
    setForm(current => ({...current, [key]: value}));

  const saveTextFile = async (prefix, text) => {
    if (!text) {
      return;
    }
    const fileName = `${prefix}-${Date.now()}.txt`;
    const path = `${
      RNFS.DownloadDirectoryPath || RNFS.DocumentDirectoryPath
    }/${fileName}`;
    try {
      await RNFS.writeFile(path, text, 'utf8');
      Alert.alert('Saved', path);
    } catch {
      const fallback = `${RNFS.DocumentDirectoryPath}/${fileName}`;
      await RNFS.writeFile(fallback, text, 'utf8');
      Alert.alert('Saved', fallback);
    }
  };

  const saveHtmlFile = () => saveTextFile('vertex-website', output);
  const hasGenerated = Boolean(imageUrl || output);

  const saveProject = async () => {
    if (!project) {
      emitEvent('toast', 'Project pehle generate karo');
      return;
    }
    try {
      const path = await writeProjectToDownloads(project);
      Alert.alert('Project saved', path);
    } catch {
      Alert.alert('Save failed', 'Project files save nahi ho paye.');
    }
  };

  const runGemini = async prompt => {
    setLoading(true);
    setOutput('');
    setProject(null);
    setRefineMessages([]);
    setRefineInput('');
    try {
      const text = await generateToolContent(prompt, selectedModel);
      setOutput(text);
      setProject(parseProjectOutput(text));
    } catch (error) {
      setOutput(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generateImage = () => {
    if (!form.imagePrompt.trim()) {
      emitEvent('toast', 'Prompt daalo');
      return;
    }
    const {width, height} = ratioSize(form.ratio);
    const styled = `${form.imagePrompt}. Style: ${form.imageStyle}`;
    setImageUrl(imageUrlForPrompt({prompt: styled, width, height}));
    setOutput(styled);
    setProject(null);
    setRefineMessages([]);
    setRefineInput('');
  };

  const resetToolState = () => {
    setOutput('');
    setImageUrl('');
    setProject(null);
    setRefineInput('');
    setRefineMessages([]);
  };

  const refineCurrentOutput = async () => {
    const instruction = refineInput.trim();
    if (!instruction || !hasGenerated || refining) {
      return;
    }
    const userMessage = {role: 'user', text: instruction};
    setRefineMessages(current => [...current, userMessage]);
    setRefineInput('');

    if (active === 'image') {
      const {width, height} = ratioSize(form.ratio);
      const basePrompt =
        output || `${form.imagePrompt}. Style: ${form.imageStyle}`;
      const nextPrompt = `${basePrompt}. Apply this change: ${instruction}. Keep the same overall subject and composition unless the change asks otherwise.`;
      setOutput(nextPrompt);
      setImageUrl(imageUrlForPrompt({prompt: nextPrompt, width, height}));
      setRefineMessages(current => [
        ...current,
        {role: 'assistant', text: 'Image update ho gayi.'},
      ]);
      return;
    }

    setRefining(true);
    try {
      const currentOutput = project ? JSON.stringify(project) : output;
      const text = await generateToolContent(
        {
          action: 'refine',
          type: active,
          currentOutput,
          instruction,
        },
        selectedModel,
      );
      setOutput(text);
      setProject(parseProjectOutput(text));
      setRefineMessages(current => [
        ...current,
        {role: 'assistant', text: 'Changes apply ho gaye.'},
      ]);
    } catch (error) {
      setRefineMessages(current => [
        ...current,
        {role: 'assistant', text: error.message || 'Change failed.'},
      ]);
    } finally {
      setRefining(false);
    }
  };

  const downloadImage = async () => {
    if (!imageUrl) {
      return;
    }
    const path = `${
      RNFS.DownloadDirectoryPath || RNFS.DocumentDirectoryPath
    }/vertex-image-${Date.now()}.png`;
    try {
      await RNFS.downloadFile({fromUrl: imageUrl, toFile: path}).promise;
      Alert.alert('Image saved', path);
    } catch {
      Alert.alert('Download failed', 'Try again with internet connected.');
    }
  };

  const generateForActive = () => {
    if (active === 'video') {
      return runGemini(`Create a ${form.duration} ${form.videoStyle} AI video package for this concept: ${form.videoPrompt}.
Return a script, storyboard table, shot-by-shot prompts, camera motion, music direction, and links list for Kling AI, Runway Gen-4, and Pika Labs.`);
    }
    if (active === 'code') {
      return runGemini(
        `${form.codeAction} in ${form.language}. Request/code:\n\n${form.codeText}\n\nReturn clean code, explanation, and usage notes.`,
      );
    }
    if (active === 'website') {
      return runGemini({
        type: 'website',
        description: form.websiteText,
        subtype: form.siteType,
        theme: form.siteTheme,
      });
    }
    if (active === 'app') {
      return runGemini({
        type: 'app',
        description: form.appText,
        subtype: form.appType,
        theme: form.appTheme,
      });
    }
    if (active === 'writing') {
      return runGemini(
        `Write ${form.writeType}. Tone: ${form.tone}. Length: ${form.length}. Topic/text:\n${form.writeText}`,
      );
    }
    if (active === 'music') {
      return runGemini(`Generate ${form.musicType}. Genre: ${form.genre}. Mood: ${form.mood}. Concept:\n${form.musicText}
If useful, include Suno and Udio prompt variants.`);
    }
  };

  const renderActive = () => {
    if (active === 'image') {
      return (
        <>
          <TextArea
            label="Prompt"
            value={form.imagePrompt}
            onChangeText={value => update('imagePrompt', value)}
            placeholder="Describe the image..."
          />
          <Select
            label="Style"
            options={optionSets.imageStyle}
            value={form.imageStyle}
            onChange={value => update('imageStyle', value)}
          />
          <Select
            label="Aspect Ratio"
            options={optionSets.ratio}
            value={form.ratio}
            onChange={value => update('ratio', value)}
          />
          <View style={styles.buttonRow}>
            <PrimaryButton icon={Wand2} onPress={generateImage}>
              Generate Image
            </PrimaryButton>
            <SecondaryButton
              icon={Shuffle}
              onPress={() =>
                update(
                  'imagePrompt',
                  randomPrompts[
                    Math.floor(Math.random() * randomPrompts.length)
                  ],
                )
              }>
              Random Prompt
            </SecondaryButton>
          </View>
          {imageUrl ? (
            <Output>
              <Image
                source={{uri: imageUrl}}
                style={styles.generatedImage}
                resizeMode="cover"
              />
              <SecondaryButton icon={Download} onPress={downloadImage}>
                Download
              </SecondaryButton>
            </Output>
          ) : null}
        </>
      );
    }
    if (active === 'video') {
      return (
        <>
          <TextArea
            label="Video Concept"
            value={form.videoPrompt}
            onChangeText={value => update('videoPrompt', value)}
            placeholder="A product launch reel for..."
          />
          <Select
            label="Style"
            options={optionSets.videoStyle}
            value={form.videoStyle}
            onChange={value => update('videoStyle', value)}
          />
          <Select
            label="Duration"
            options={optionSets.duration}
            value={form.duration}
            onChange={value => update('duration', value)}
          />
          <PrimaryButton
            icon={Film}
            disabled={loading}
            onPress={generateForActive}>
            Generate Video Plan
          </PrimaryButton>
          <View style={styles.linksBox}>
            <Text style={styles.linkText}>
              Free tools: Kling AI | Runway Gen-4 | Pika Labs
            </Text>
          </View>
        </>
      );
    }
    if (active === 'code') {
      return (
        <>
          <Select
            label="Language"
            options={optionSets.language}
            value={form.language}
            onChange={value => update('language', value)}
          />
          <Select
            label="Action"
            options={optionSets.codeAction}
            value={form.codeAction}
            onChange={value => update('codeAction', value)}
          />
          <TextArea
            mono
            label="Code / Request"
            value={form.codeText}
            onChangeText={value => update('codeText', value)}
            placeholder="// Paste code or describe what you need"
          />
          <PrimaryButton
            icon={Code2}
            disabled={loading}
            onPress={generateForActive}>
            Generate
          </PrimaryButton>
        </>
      );
    }
    if (active === 'website') {
      return (
        <>
          <TextArea
            label="Website Description"
            value={form.websiteText}
            onChangeText={value => update('websiteText', value)}
            placeholder="A landing page for..."
          />
          <Select
            label="Type"
            options={optionSets.siteType}
            value={form.siteType}
            onChange={value => update('siteType', value)}
          />
          <Select
            label="Theme"
            options={optionSets.theme}
            value={form.siteTheme}
            onChange={value => update('siteTheme', value)}
          />
          <PrimaryButton
            icon={Globe2}
            disabled={loading}
            onPress={generateForActive}>
            Build Website
          </PrimaryButton>
          <View style={styles.buttonRow}>
            <SecondaryButton icon={Download} onPress={saveHtmlFile}>
              Download Output
            </SecondaryButton>
            {project ? (
              <SecondaryButton icon={Download} onPress={saveProject}>
                Download Project
              </SecondaryButton>
            ) : null}
            <SecondaryButton
              icon={Play}
              onPress={() => setPreviewHtml(extractPreviewHtml(output))}>
              Preview
            </SecondaryButton>
          </View>
        </>
      );
    }
    if (active === 'app') {
      return (
        <>
          <TextArea
            label="App Description"
            value={form.appText}
            onChangeText={value => update('appText', value)}
            placeholder="A habit tracker with..."
          />
          <Select
            label="Type"
            options={optionSets.appType}
            value={form.appType}
            onChange={value => update('appType', value)}
          />
          <Select
            label="Theme"
            options={optionSets.appTheme}
            value={form.appTheme}
            onChange={value => update('appTheme', value)}
          />
          <PrimaryButton
            icon={Smartphone}
            disabled={loading}
            onPress={generateForActive}>
            Build App
          </PrimaryButton>
          <View style={styles.buttonRow}>
            <SecondaryButton
              icon={Download}
              onPress={() =>
                project
                  ? saveTextFile('vertex-app', projectToText(project))
                  : saveTextFile('vertex-app', output)
              }>
              Download Output
            </SecondaryButton>
            {project ? (
              <SecondaryButton icon={Download} onPress={saveProject}>
                Download Project
              </SecondaryButton>
            ) : null}
            <SecondaryButton
              icon={Play}
              onPress={() => setPreviewHtml(extractPreviewHtml(output))}>
              Preview
            </SecondaryButton>
          </View>
        </>
      );
    }
    if (active === 'writing') {
      return (
        <>
          <Select
            label="Type"
            options={optionSets.writeType}
            value={form.writeType}
            onChange={value => update('writeType', value)}
          />
          <Select
            label="Tone"
            options={optionSets.tone}
            value={form.tone}
            onChange={value => update('tone', value)}
          />
          <Select
            label="Length"
            options={optionSets.length}
            value={form.length}
            onChange={value => update('length', value)}
          />
          <TextArea
            label="Topic / Text"
            value={form.writeText}
            onChangeText={value => update('writeText', value)}
            placeholder="Paste or describe..."
          />
          <PrimaryButton
            icon={PenLine}
            disabled={loading}
            onPress={generateForActive}>
            Generate
          </PrimaryButton>
        </>
      );
    }
    return (
      <>
        <Select
          label="Type"
          options={optionSets.musicType}
          value={form.musicType}
          onChange={value => update('musicType', value)}
        />
        <Select
          label="Genre"
          options={optionSets.genre}
          value={form.genre}
          onChange={value => update('genre', value)}
        />
        <Select
          label="Mood"
          options={optionSets.mood}
          value={form.mood}
          onChange={value => update('mood', value)}
        />
        <TextArea
          label="Concept"
          value={form.musicText}
          onChangeText={value => update('musicText', value)}
          placeholder="A motivational college anthem..."
        />
        <PrimaryButton
          icon={Music}
          disabled={loading}
          onPress={generateForActive}>
          Generate
        </PrimaryButton>
        <View style={styles.linksBox}>
          <Text style={styles.linkText}>Try the prompts in Suno or Udio.</Text>
        </View>
      </>
    );
  };

  return (
    <View
      style={[
        styles.screen,
        themeMode === 'light' && {backgroundColor: '#f6f7fb'},
      ]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}>
        {tabs.map(item => {
          const Icon = item.Icon;
          const selected = item.id === active;
          return (
            <Pressable
              key={item.id}
              style={[styles.tab, selected && styles.tabActive]}
              onPress={() => {
                setActive(item.id);
                resetToolState();
              }}>
              <Icon size={16} color={selected ? COLORS.cyan : COLORS.soft} />
              <Text style={[styles.tabText, selected && styles.tabTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View>
            <Text style={styles.title}>{tab.title}</Text>
            <Text style={styles.subtitle}>
              AI tools packed into the same dark vertex.ai workspace.
            </Text>
          </View>
          <View
            style={[styles.badge, tab.badge === 'Beta' && styles.betaBadge]}>
            <Text style={styles.badgeText}>{tab.badge}</Text>
          </View>
        </View>
        {renderActive()}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={COLORS.gold} />
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={[COLORS.cyan, COLORS.purple, COLORS.gold]}
                style={styles.progressFill}
              />
            </View>
          </View>
        ) : null}
        {active !== 'image' ? (
          <Output
            output={project ? projectToText(project) : output}
            onCopy={
              output
                ? () => {
                    Clipboard.setString(
                      project ? projectToText(project) : output,
                    );
                    emitEvent('toast', 'Copied!');
                  }
                : null
            }
            onDownload={
              output
                ? () =>
                    project
                      ? saveProject()
                      : saveTextFile(`vertex-${active}`, output)
                : null
            }>
            {project ? (
              <ProjectPanel project={project} onDownload={saveProject} />
            ) : null}
          </Output>
        ) : null}
        {hasGenerated ? (
          <RefineChat
            active={active}
            disabled={loading || refining}
            messages={refineMessages}
            value={refineInput}
            onChangeText={setRefineInput}
            onSubmit={refineCurrentOutput}
          />
        ) : null}
      </ScrollView>

      <Modal
        visible={Boolean(previewHtml)}
        animationType="slide"
        onRequestClose={() => setPreviewHtml('')}>
        <View style={styles.previewTop}>
          <Text style={styles.previewTitle}>Preview</Text>
          <Pressable
            onPress={() => setPreviewHtml('')}
            style={styles.previewClose}>
            <X size={18} color={COLORS.text} />
          </Pressable>
        </View>
        <WebView
          originWhitelist={['*']}
          source={{html: previewHtml || '<html><body></body></html>'}}
        />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  tabs: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  tab: {
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
  },
  tabActive: {
    borderColor: 'rgba(91,231,255,0.35)',
    backgroundColor: 'rgba(91,231,255,0.10)',
  },
  tabText: {
    color: COLORS.soft,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: FONT.bold,
  },
  tabTextActive: {
    color: COLORS.cyan,
  },
  content: {
    padding: 14,
    gap: 14,
    paddingBottom: 30,
  },
  headerCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.035)',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  subtitle: {
    color: COLORS.soft,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    maxWidth: 245,
    fontFamily: FONT.regular,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(74,222,128,0.16)',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  betaBadge: {
    backgroundColor: 'rgba(255,211,110,0.16)',
  },
  badgeText: {
    color: COLORS.green,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  block: {
    gap: 7,
  },
  label: {
    color: '#9fa8c8',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: FONT.bold,
  },
  textArea: {
    minHeight: 118,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: 'rgba(0,0,0,0.35)',
    color: COLORS.text,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: FONT.regular,
  },
  monoInput: {
    fontFamily: 'monospace',
  },
  optionRow: {
    gap: 8,
  },
  option: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionActive: {
    borderColor: 'rgba(99,102,241,0.48)',
    backgroundColor: 'rgba(99,102,241,0.18)',
  },
  optionText: {
    color: COLORS.soft,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: FONT.bold,
  },
  optionTextActive: {
    color: COLORS.text,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    alignItems: 'center',
  },
  primary: {
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryText: {
    color: '#111',
    fontSize: 14,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  secondary: {
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: FONT.bold,
  },
  outputCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: 14,
    gap: 12,
    ...shadow.card,
  },
  outputTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  outputTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  outputActions: {
    flexDirection: 'row',
    gap: 7,
  },
  smallIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outputText: {
    color: COLORS.text,
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 19,
  },
  projectCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(91,231,255,0.18)',
    backgroundColor: 'rgba(91,231,255,0.055)',
    padding: 12,
    gap: 10,
  },
  projectName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  projectSummary: {
    color: COLORS.soft,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },
  projectStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  projectStat: {
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: COLORS.cyan,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  fileList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filePill: {
    maxWidth: '100%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(0,0,0,0.22)',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  filePillText: {
    color: COLORS.text,
    fontSize: 10,
    fontFamily: 'monospace',
  },
  commandsText: {
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.28)',
    color: COLORS.gold,
    padding: 10,
    fontSize: 11,
    lineHeight: 17,
    fontFamily: 'monospace',
  },
  refineCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(139,91,255,0.22)',
    backgroundColor: 'rgba(139,91,255,0.07)',
    padding: 12,
    gap: 10,
  },
  refineTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  refineSub: {
    color: COLORS.soft,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: FONT.regular,
  },
  refineMessages: {
    gap: 7,
  },
  refineBubble: {
    maxWidth: '88%',
    borderRadius: 13,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  refineUserBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
    backgroundColor: COLORS.indigo,
  },
  refineAiBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  refineBubbleText: {
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONT.medium,
  },
  refineUserText: {
    color: '#fff',
    fontWeight: '700',
    fontFamily: FONT.semiBold,
  },
  refineInputRow: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: 'rgba(0,0,0,0.32)',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  refineInput: {
    flex: 1,
    maxHeight: 104,
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 19,
    padding: 0,
    fontFamily: FONT.regular,
  },
  refineSend: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gold,
  },
  refineSendDisabled: {
    opacity: 0.45,
  },
  generatedImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: COLORS.bg,
  },
  loadingBox: {
    gap: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 12,
  },
  progressTrack: {
    height: 5,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    width: '78%',
    height: '100%',
    borderRadius: 5,
  },
  linksBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(91,231,255,0.2)',
    backgroundColor: 'rgba(91,231,255,0.06)',
    padding: 12,
  },
  linkText: {
    color: COLORS.soft,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },
  previewTop: {
    height: 58,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  previewClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ToolsScreen;
