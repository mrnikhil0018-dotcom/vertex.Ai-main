import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  Easing,
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
import Clipboard from '@react-native-clipboard/clipboard';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import Tts from 'react-native-tts';
import Voice from '@react-native-voice/voice';
import {
  Code2,
  Copy,
  Download,
  Eye,
  Film,
  Globe2,
  Image as ImageIcon,
  Lightbulb,
  Mic,
  Music,
  Paperclip,
  PenLine,
  Send,
  Sparkles,
  Smartphone,
  Volume2,
  X,
} from 'lucide-react-native';
import {WebView} from 'react-native-webview';
import MarkdownRenderer from '../components/MarkdownRenderer';
import {buildSystemPrompt, callChat} from '../services/api';
import {emitEvent, onEvent} from '../utils/events';
import {
  extractPreviewHtml,
  parseProjectOutput,
  projectToText,
  writeProjectToDownloads,
} from '../utils/projectOutput';
import {COLORS, FONT, GRADIENTS, radius, shadow} from '../utils/theme';
import {upsertChat} from '../utils/storage';

const MAX_CHARS = 2000;

const modelProfiles = {
  vertex: {
    label: 'Vertex Auto',
    subtitle: 'Smart fallback model',
    bg: COLORS.bg,
    surface: 'rgba(255,255,255,0.055)',
    border: COLORS.border,
    accent: COLORS.gold,
    gradient: GRADIENTS.userBubble,
  },
  gemini: {
    label: 'Gemini',
    subtitle: 'Gemini-style workspace',
    bg: '#06101f',
    surface: 'rgba(66,133,244,0.14)',
    border: 'rgba(66,133,244,0.28)',
    accent: '#8ab4f8',
    gradient: ['#4285f4', '#a142f4'],
  },
  chatgpt: {
    label: 'ChatGPT',
    subtitle: 'Clean assistant workspace',
    bg: '#071412',
    surface: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.28)',
    accent: '#10b981',
    gradient: ['#10b981', '#0f766e'],
  },
  grok: {
    label: 'Grok',
    subtitle: 'Sharp minimal workspace',
    bg: '#070707',
    surface: 'rgba(255,255,255,0.08)',
    border: 'rgba(255,255,255,0.16)',
    accent: '#f5f5f5',
    gradient: ['#3f3f46', '#111827'],
  },
  claude: {
    label: 'Claude',
    subtitle: 'Warm writing workspace',
    bg: '#17100b',
    surface: 'rgba(217,119,6,0.13)',
    border: 'rgba(217,119,6,0.27)',
    accent: '#f59e0b',
    gradient: ['#d97706', '#7c2d12'],
  },
};

const homeChips = {
  gemini: ['Create image', 'Create music', 'Write anything', 'Help me learn'],
  chatgpt: ['New chat', 'Search chats', 'Projects', 'Code'],
  grok: ['Imagine', 'Explain fast', 'Analyze this', 'Build something'],
  claude: ['Write', 'Learn', 'Code', "Claude's choice"],
  vertex: ['Explain anything', 'Write code', 'Build website', 'Help me decide'],
};

const timeString = () =>
  new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});

const greeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return 'Good Morning';
  }
  if (hour >= 12 && hour < 17) {
    return 'Good Afternoon';
  }
  return 'Good Evening';
};

const BouncingDots = () => {
  const values = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  useEffect(() => {
    const animations = values.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 160),
          Animated.timing(value, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 320,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(420),
        ]),
      ),
    );
    animations.forEach(animation => animation.start());
    return () => animations.forEach(animation => animation.stop());
  }, [values]);
  return (
    <View style={styles.dots}>
      {values.map((value, index) => (
        <Animated.View
          key={index}
          style={[
            styles.dot,
            {
              opacity: value.interpolate({
                inputRange: [0, 1],
                outputRange: [0.4, 1],
              }),
              transform: [
                {
                  translateY: value.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -6],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
};

const toolIcons = {
  image: ImageIcon,
  website: Globe2,
  app: Smartphone,
  video: Film,
  music: Music,
  code: Code2,
  writing: PenLine,
};

const toolExtension = tool => {
  if (['website', 'app'].includes(tool?.type)) {
    return 'html';
  }
  if (tool?.type === 'image') {
    return 'png';
  }
  return 'txt';
};

const toolPayloadText = tool => {
  const project = parseProjectOutput(tool?.output);
  if (project) {
    return projectToText(project);
  }
  return tool?.output || tool?.url || tool?.prompt || 'Generated output';
};

const saveToolOutput = async tool => {
  if (!tool) {
    return;
  }
  const project = parseProjectOutput(tool.output);
  if (project) {
    try {
      const folder = await writeProjectToDownloads(project);
      Alert.alert('Project saved', folder);
    } catch {
      emitEvent('toast', 'Project save failed');
    }
    return;
  }
  const ext = toolExtension(tool);
  const target = `${
    RNFS.DownloadDirectoryPath || RNFS.DocumentDirectoryPath
  }/vertex-${tool.type || 'tool'}-${Date.now()}.${ext}`;
  try {
    if (tool.type === 'image' && tool.url) {
      await RNFS.downloadFile({fromUrl: tool.url, toFile: target}).promise;
    } else {
      await RNFS.writeFile(target, toolPayloadText(tool), 'utf8');
    }
    Alert.alert('Saved', target);
  } catch {
    emitEvent('toast', 'Download failed');
  }
};

const ToolCard = ({tool}) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  if (!tool) {
    return null;
  }
  const Icon = toolIcons[tool.type] || Lightbulb;
  const output = tool.output || '';
  const project = parseProjectOutput(output);
  const outputText = project ? projectToText(project) : output;
  const canPreview = ['website', 'app'].includes(tool.type) && output;
  const previewHtml = canPreview ? extractPreviewHtml(output) : '';
  return (
    <View style={styles.toolCard}>
      <View style={styles.toolHeader}>
        <View style={styles.toolTitleRow}>
          <View style={styles.toolIconBox}>
            <Icon size={15} color={COLORS.gold} />
          </View>
          <View style={styles.toolHeaderText}>
            <Text style={styles.toolTitle}>
              {tool.title || 'Generated Tool'}
            </Text>
            {tool.prompt ? (
              <Text style={styles.toolPrompt} numberOfLines={2}>
                {tool.prompt}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.toolActions}>
          {canPreview ? (
            <Pressable
              style={styles.toolAction}
              onPress={() => setPreviewOpen(true)}>
              <Eye size={12} color={COLORS.soft} />
            </Pressable>
          ) : null}
          <Pressable
            style={styles.toolAction}
            onPress={() => {
              Clipboard.setString(
                project ? projectToText(project) : toolPayloadText(tool),
              );
              emitEvent('toast', 'Tool output copied');
            }}>
            <Copy size={12} color={COLORS.soft} />
          </Pressable>
          <Pressable
            style={styles.toolAction}
            onPress={() => saveToolOutput(tool)}>
            <Download size={12} color={COLORS.soft} />
          </Pressable>
        </View>
      </View>
      {tool.type === 'image' && tool.url ? (
        <Image
          source={{uri: tool.url}}
          style={styles.toolImage}
          resizeMode="cover"
        />
      ) : null}
      {output ? (
        <View style={styles.toolOutput}>
          {project ? (
            <View style={styles.projectSummaryCard}>
              <Text style={styles.projectName}>{project.projectName}</Text>
              {project.summary ? (
                <Text style={styles.projectSummary}>{project.summary}</Text>
              ) : null}
              <View style={styles.projectStats}>
                <Text style={styles.projectStat}>
                  {project.files.length} files
                </Text>
                <Text style={styles.projectStat}>
                  {project.type === 'mobile-app'
                    ? 'React Native'
                    : 'React + Vite'}
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
            </View>
          ) : (
            <MarkdownRenderer content={outputText} />
          )}
        </View>
      ) : null}
      <Modal
        animationType="slide"
        visible={previewOpen}
        onRequestClose={() => setPreviewOpen(false)}>
        <View style={styles.previewScreen}>
          <View style={styles.previewTop}>
            <Text style={styles.previewTitle}>Preview</Text>
            <Pressable
              onPress={() => setPreviewOpen(false)}
              style={styles.previewClose}>
              <X size={16} color={COLORS.text} />
            </Pressable>
          </View>
          <WebView
            originWhitelist={['*']}
            source={{html: previewHtml}}
            javaScriptEnabled
            domStorageEnabled
            style={styles.previewWebview}
          />
        </View>
      </Modal>
    </View>
  );
};

const MessageBubble = ({message, modelProfile, isLight}) => {
  const isUser = message.role === 'user';
  const speak = () =>
    Tts.speak(
      `${message.content}\n${message.tool?.output || ''}`
        .replace(/[*_`#>]/g, '')
        .slice(0, 900),
    );
  return (
    <View style={[styles.messageRow, isUser ? styles.userRow : styles.aiRow]}>
      {isUser ? (
        <LinearGradient
          colors={modelProfile.gradient}
          style={[styles.bubble, styles.userBubble]}>
          <Text selectable style={styles.userText}>
            {message.content}
          </Text>
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.bubble,
            styles.aiBubble,
            isLight && styles.aiBubbleLight,
          ]}>
          <MarkdownRenderer content={message.content} />
          <ToolCard tool={message.tool} />
        </View>
      )}
      <Text style={[styles.time, isUser && styles.timeRight]}>
        {message.time}
      </Text>
      {!isUser ? (
        <View style={styles.actions}>
          <Pressable
            style={styles.actionButton}
            onPress={() => {
              Clipboard.setString(message.content);
              if (message.tool) {
                Clipboard.setString(
                  `${message.content}\n\n${toolPayloadText(message.tool)}`,
                );
              }
              emitEvent('toast', 'Copied!');
            }}>
            <Copy size={12} color={COLORS.soft} />
          </Pressable>
          <Pressable style={styles.actionButton} onPress={speak}>
            <Volume2 size={12} color={COLORS.soft} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

const ChatScreen = ({user, voiceOutput, themeMode = 'dark'}) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [systemOpen, setSystemOpen] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [typing, setTyping] = useState(false);
  const [attached, setAttached] = useState(null);
  const [listening, setListening] = useState(false);
  const chatId = useRef(null);
  const scrollRef = useRef(null);
  const activeRequestRef = useRef(null);
  const typingTimerRef = useRef(null);
  const logoPulse = useRef(new Animated.Value(0)).current;
  const selectedModel = 'vertex';
  const modelProfile = modelProfiles.vertex;
  const isLight = themeMode === 'light';
  const firstName = (user?.name || 'Nikhil').trim().split(/\s+/)[0] || 'Nikhil';

  const hasMessages = messages.length > 0;
  const counterClass =
    input.length >= MAX_CHARS
      ? styles.counterLimit
      : input.length >= MAX_CHARS * 0.8
      ? styles.counterWarn
      : null;

  const clearTypingWatchdog = useCallback(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    Tts.setDefaultLanguage('hi-IN').catch(() =>
      Tts.setDefaultLanguage('en-IN').catch(() => {}),
    );
    Voice.onSpeechResults = event => setInput(event.value?.[0] || '');
    Voice.onSpeechEnd = () => setListening(false);
    Voice.onSpeechError = () => setListening(false);
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(logoPulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    const offNew = onEvent('chat:new', () => {
      activeRequestRef.current = null;
      clearTypingWatchdog();
      setMessages([]);
      chatId.current = null;
      setTyping(false);
    });
    const offSys = onEvent('chat:system', () => setSystemOpen(value => !value));
    const offLoad = onEvent('chat:load', chat => {
      activeRequestRef.current = null;
      clearTypingWatchdog();
      setMessages(chat.messages || []);
      chatId.current = chat.id;
      setTyping(false);
    });
    const offDeleted = onEvent('chat:deleted', id => {
      if (chatId.current === id) {
        activeRequestRef.current = null;
        clearTypingWatchdog();
        setMessages([]);
        chatId.current = null;
        setTyping(false);
      }
    });
    return () => {
      offNew();
      offSys();
      offLoad();
      offDeleted();
      clearTypingWatchdog();
      activeRequestRef.current = null;
      Voice.destroy()
        .then(Voice.removeAllListeners)
        .catch(() => {});
    };
  }, [clearTypingWatchdog, logoPulse]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({animated: true}), 50);
  }, [messages, typing]);

  const persistChat = useCallback(async next => {
    if (!next.length) {
      return;
    }
    const firstUser =
      next.find(item => item.role === 'user')?.content || 'Chat';
    const id = chatId.current || Date.now();
    chatId.current = id;
    await upsertChat({
      id,
      preview: firstUser.slice(0, 45),
      date: new Date().toLocaleDateString(),
      messages: next,
    });
    emitEvent('chats:changed');
  }, []);

  const exportChat = useCallback(async () => {
    const currentMessages = messages;
    if (!currentMessages.length) {
      emitEvent('toast', 'No messages to export');
      return;
    }
    const text = currentMessages
      .map(
        item =>
          `${item.role === 'assistant' ? 'vertex.ai' : 'You'}: ${item.content}${
            item.tool ? `\n\n[Tool Output]\n${toolPayloadText(item.tool)}` : ''
          }`,
      )
      .join('\n\n');
    const fileName = `vertex-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    const target = `${
      RNFS.DownloadDirectoryPath || RNFS.DocumentDirectoryPath
    }/${fileName}`;
    try {
      await RNFS.writeFile(target, text, 'utf8');
      Alert.alert('Chat exported', target);
    } catch (error) {
      const fallback = `${RNFS.DocumentDirectoryPath}/${fileName}`;
      await RNFS.writeFile(fallback, text, 'utf8');
      Alert.alert('Chat exported', fallback);
    }
  }, [messages]);

  useEffect(() => onEvent('chat:export', exportChat), [exportChat]);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.pickSingle({
        copyTo: 'cachesDirectory',
      });
      setAttached(result);
    } catch (error) {
      if (!DocumentPicker.isCancel(error)) {
        emitEvent('toast', 'File picker failed');
      }
    }
  };

  const toggleMic = async () => {
    try {
      if (listening) {
        await Voice.stop();
        setListening(false);
      } else {
        setListening(true);
        await Voice.start('hi-IN');
      }
    } catch {
      setListening(false);
      emitEvent('toast', 'Voice input unavailable');
    }
  };

  const sendMessage = useCallback(
    async (overrideText = '') => {
      const raw = (overrideText || input).trim();
      if ((!raw && !attached) || typing) {
        return;
      }
      const content = attached
        ? `${raw ? `${raw}\n` : ''}[Attached: ${attached.name}]`
        : raw;
      const userMessage = {role: 'user', content, time: timeString()};
      const withUser = [...messages, userMessage];
      setMessages(withUser);
      setInput('');
      setAttached(null);
      setTyping(true);
      const requestId = Date.now();
      activeRequestRef.current = requestId;
      clearTypingWatchdog();
      typingTimerRef.current = setTimeout(() => {
        if (activeRequestRef.current !== requestId) {
          return;
        }
        typingTimerRef.current = null;
        activeRequestRef.current = null;
        setTyping(false);
        setMessages(current => [
          ...current,
          {
            role: 'assistant',
            content:
              '**Timeout:** Backend se response nahi aaya. Internet/backend check karke dobara try karo.',
            time: timeString(),
          },
        ]);
      }, 30000);
      try {
        const result = await callChat({
          history: withUser,
          systemPrompt: buildSystemPrompt(systemPrompt.trim()),
          provider: 'vertex',
        });
        if (activeRequestRef.current !== requestId) {
          return;
        }
        const aiMessage = {
          role: 'assistant',
          content: result.reply,
          time: timeString(),
          tool: result.tool,
        };
        const next = [...withUser, aiMessage];
        setMessages(next);
        await persistChat(next);
        if (voiceOutput) {
          Tts.speak(result.reply.replace(/[*_`#>]/g, '').slice(0, 900));
        }
      } catch (error) {
        if (activeRequestRef.current !== requestId) {
          return;
        }
        const aiMessage = {
          role: 'assistant',
          content: `**Error:** ${error.message}`,
          time: timeString(),
        };
        setMessages([...withUser, aiMessage]);
      } finally {
        if (activeRequestRef.current === requestId) {
          activeRequestRef.current = null;
          clearTypingWatchdog();
          setTyping(false);
        }
      }
    },
    [
      attached,
      clearTypingWatchdog,
      input,
      messages,
      persistChat,
      systemPrompt,
      typing,
      voiceOutput,
    ],
  );

  const emptyLogoScale = logoPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  const emptyState = useMemo(() => {
    const homeData = {
      gemini: {
        brand: 'Gemini',
        overline: `Hi ${firstName}`,
        title: 'Where should we start?',
        prompt: 'Ask Gemini',
      },
      chatgpt: {
        brand: 'ChatGPT',
        title: 'What can I help with?',
        prompt: 'Ask anything',
      },
      grok: {
        brand: 'Grok',
        title: 'Grok',
        prompt: 'What do you want to know?',
      },
      claude: {
        brand: 'Claude',
        title: `${greeting()}, ${firstName}`,
        prompt: 'How can I help you today?',
      },
      vertex: {
        brand: 'vertex.ai',
        title: greeting(),
        prompt: 'Ask vertex.ai anything...',
      },
    };
    const data = homeData[selectedModel] || homeData.vertex;
    const chips = homeChips[selectedModel] || homeChips.vertex;
    const showRail = ['gemini', 'chatgpt', 'claude'].includes(selectedModel);
    const isGrok = selectedModel === 'grok';

    return (
      <View
        style={[
          styles.modelHome,
          isLight && styles.modelHomeLight,
          isGrok && styles.grokHome,
        ]}>
        {showRail ? (
          <View
            style={[
              styles.modelRail,
              isLight && styles.modelRailLight,
              selectedModel === 'claude' && styles.claudeRail,
            ]}>
            <Text style={[styles.railBrand, isLight && styles.railBrandLight]}>
              {data.brand}
            </Text>
            {['New chat', 'Search', 'Tools'].map(item => (
              <Pressable
                key={item}
                onPress={() => sendMessage(item)}
                style={styles.railItem}>
                <View
                  style={[
                    styles.railDot,
                    {backgroundColor: modelProfile.accent},
                  ]}
                />
                <Text
                  style={[styles.railText, isLight && styles.railTextLight]}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.homeCenter}>
          {isGrok ? (
            <Animated.View style={{transform: [{scale: emptyLogoScale}]}}>
              <Text style={styles.grokLogo}>Grok</Text>
            </Animated.View>
          ) : (
            <View style={styles.homeBrandRow}>
              <Sparkles size={24} color={modelProfile.accent} />
              <Text
                style={[
                  styles.homeBrand,
                  {color: isLight ? '#111827' : COLORS.text},
                ]}>
                {data.brand}
              </Text>
            </View>
          )}
          {data.overline ? (
            <Text style={[styles.homeOverline, isLight && styles.lightSoft]}>
              {data.overline}
            </Text>
          ) : null}
          <Text
            style={[
              styles.homeTitle,
              isGrok && styles.grokTitle,
              isLight && styles.lightTitle,
              selectedModel === 'claude' && {color: '#d6c8b8'},
            ]}>
            {data.title}
          </Text>
          <Pressable
            onPress={() => sendMessage(data.prompt)}
            style={[
              styles.promptPreview,
              {
                borderColor: modelProfile.border,
                backgroundColor: isLight ? '#ffffff' : modelProfile.surface,
              },
            ]}>
            <Text
              style={[styles.promptPreviewText, isLight && styles.lightSoft]}>
              {data.prompt}
            </Text>
            <Text
              style={[styles.promptPreviewModel, {color: modelProfile.accent}]}>
              {modelProfile.label}
            </Text>
          </Pressable>
          <View style={styles.modelChipRow}>
            {chips.map(chip => (
              <Pressable
                key={chip}
                onPress={() => sendMessage(chip)}
                style={[
                  styles.modelChip,
                  {
                    borderColor: modelProfile.border,
                    backgroundColor: isLight
                      ? '#ffffff'
                      : 'rgba(255,255,255,0.055)',
                  },
                ]}>
                <Text
                  style={[
                    styles.modelChipText,
                    {color: isLight ? '#111827' : COLORS.text},
                  ]}>
                  {chip}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    );
  }, [
    emptyLogoScale,
    firstName,
    isLight,
    modelProfile,
    selectedModel,
    sendMessage,
  ]);

  return (
    <View
      style={[
        styles.screen,
        {backgroundColor: isLight ? '#f6f7fb' : modelProfile.bg},
      ]}>
      {systemOpen ? (
        <View style={styles.systemBar}>
          <Text style={styles.systemLabel}>Persona:</Text>
          <TextInput
            value={systemPrompt}
            onChangeText={setSystemPrompt}
            placeholder={'e.g. "Act as a BCA tutor..."'}
            placeholderTextColor={COLORS.soft}
            style={styles.systemInput}
          />
          <Pressable
            onPress={() => setSystemOpen(false)}
            style={styles.systemClose}>
            <X size={16} color={COLORS.soft} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.chatArea}>
        {!hasMessages ? (
          emptyState
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.messages}
            showsVerticalScrollIndicator={false}>
            {messages.map((message, index) => (
              <MessageBubble
                key={`${message.time}-${index}`}
                message={message}
                modelProfile={modelProfile}
                isLight={isLight}
              />
            ))}
            {typing ? (
              <View style={[styles.messageRow, styles.aiRow]}>
                <View style={[styles.bubble, styles.thinking]}>
                  <Text style={styles.thinkingText}>
                    vertex.ai is thinking...
                  </Text>
                  <BouncingDots />
                </View>
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>

      {attached ? (
        <View style={styles.mediaStrip}>
          <Paperclip size={13} color="#c5b0ff" />
          <Text style={styles.mediaName} numberOfLines={1}>
            {attached.name}
          </Text>
          <Pressable
            onPress={() => setAttached(null)}
            style={styles.mediaClose}>
            <X size={11} color={COLORS.soft} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.composerOuter}>
        <View style={[styles.composer, isLight && styles.composerLight]}>
          <Pressable
            onPress={toggleMic}
            style={[styles.roundButton, listening && styles.micActive]}>
            <Mic size={18} color={listening ? COLORS.cyan : COLORS.soft} />
          </Pressable>
          <Pressable onPress={pickFile} style={styles.roundButton}>
            <Paperclip size={18} color={COLORS.soft} />
          </Pressable>
          <View
            style={[styles.vertexBadge, isLight && styles.vertexBadgeLight]}>
            <Sparkles size={13} color={modelProfile.accent} />
            <Text
              numberOfLines={1}
              style={[
                styles.vertexBadgeText,
                isLight && styles.vertexBadgeTextLight,
              ]}>
              vertex.ai
            </Text>
          </View>
          <TextInput
            value={input}
            onChangeText={text => setInput(text.slice(0, MAX_CHARS))}
            placeholder="Ask vertex.ai anything..."
            placeholderTextColor={isLight ? '#667085' : COLORS.soft}
            style={[styles.input, isLight && styles.inputLight]}
            multiline
          />
          <Pressable onPress={() => sendMessage()} disabled={typing}>
            <LinearGradient
              colors={modelProfile.gradient}
              style={styles.sendButton}>
              <Send size={15} color="#fff" fill="#fff" />
              <Text style={styles.sendText}>Send</Text>
            </LinearGradient>
          </Pressable>
        </View>
        <View style={styles.hintRow}>
          <Text style={styles.hint}>Enter to send</Text>
          {input.length >= MAX_CHARS * 0.8 ? (
            <Text style={[styles.counter, counterClass]}>
              {Math.min(input.length, MAX_CHARS)}/{MAX_CHARS}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  modelBar: {
    minHeight: 54,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modelName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  modelSub: {
    color: COLORS.soft,
    fontSize: 11,
    marginTop: 1,
    fontFamily: FONT.regular,
  },
  modelDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  modelHome: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  modelHomeLight: {
    backgroundColor: '#f6f7fb',
  },
  grokHome: {
    backgroundColor: '#000000',
  },
  modelRail: {
    width: 92,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    paddingTop: 18,
    paddingHorizontal: 8,
    gap: 9,
  },
  modelRailLight: {
    backgroundColor: '#ffffff',
    borderRightColor: 'rgba(0,0,0,0.08)',
  },
  claudeRail: {
    backgroundColor: 'rgba(214,200,184,0.06)',
  },
  railBrand: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
    marginBottom: 8,
  },
  railBrandLight: {
    color: '#111827',
  },
  railItem: {
    minHeight: 34,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  railDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  railText: {
    flex: 1,
    color: COLORS.soft,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: FONT.bold,
  },
  railTextLight: {
    color: '#667085',
  },
  homeCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
    gap: 16,
  },
  homeBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  homeBrand: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  homeOverline: {
    color: COLORS.soft,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FONT.semiBold,
    marginBottom: -10,
  },
  homeTitle: {
    color: COLORS.text,
    fontSize: 30,
    lineHeight: 37,
    textAlign: 'center',
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  grokLogo: {
    color: '#ffffff',
    fontSize: 42,
    lineHeight: 50,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  grokTitle: {
    fontSize: 0,
    lineHeight: 0,
  },
  promptPreview: {
    width: '100%',
    maxWidth: 560,
    minHeight: 72,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  promptPreviewText: {
    flex: 1,
    color: COLORS.soft,
    fontSize: 15,
    fontFamily: FONT.regular,
  },
  promptPreviewModel: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  modelChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 9,
    maxWidth: 560,
  },
  modelChip: {
    minHeight: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelChipText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: FONT.bold,
  },
  systemBar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: 'rgba(139,91,255,0.07)',
  },
  systemLabel: {
    color: COLORS.soft,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONT.semiBold,
  },
  systemInput: {
    flex: 1,
    color: COLORS.text,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderStrong,
    paddingVertical: 2,
    fontSize: 13,
    fontFamily: FONT.regular,
  },
  systemClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatArea: {
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 18,
  },
  emptyLogo: {
    width: 52,
    height: 52,
    borderRadius: 16,
  },
  greeting: {
    color: COLORS.text,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
    textAlign: 'center',
    fontFamily: FONT.extraBold,
  },
  subGreeting: {
    color: COLORS.soft,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: -8,
    fontFamily: FONT.regular,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.25)',
    backgroundColor: 'rgba(74,222,128,0.07)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.green,
  },
  onlineText: {
    color: COLORS.green,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: FONT.bold,
  },
  chipGrid: {
    width: '100%',
    maxWidth: 540,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 11,
  },
  chip: {
    width: '48%',
    minHeight: 126,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 17,
    alignItems: 'flex-start',
    gap: 9,
  },
  chipIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  chipHint: {
    color: COLORS.soft,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONT.regular,
  },
  messages: {
    padding: 16,
    paddingBottom: 8,
    gap: 11,
  },
  messageRow: {
    gap: 4,
  },
  userRow: {
    alignItems: 'flex-end',
  },
  aiRow: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 18,
  },
  userBubble: {
    borderBottomRightRadius: 5,
    ...shadow.card,
  },
  aiBubble: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderBottomLeftRadius: 5,
  },
  aiBubbleLight: {
    borderColor: 'rgba(0,0,0,0.14)',
    backgroundColor: '#111827',
  },
  toolCard: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,211,110,0.18)',
    backgroundColor: 'rgba(5,5,7,0.55)',
    overflow: 'hidden',
  },
  toolHeader: {
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  toolTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolIconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,211,110,0.12)',
  },
  toolHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  toolTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  toolPrompt: {
    color: COLORS.soft,
    fontSize: 10,
    marginTop: 2,
    fontFamily: FONT.regular,
  },
  toolActions: {
    flexDirection: 'row',
    gap: 5,
  },
  toolAction: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  toolImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  toolOutput: {
    padding: 10,
  },
  projectSummaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(91,231,255,0.16)',
    backgroundColor: 'rgba(91,231,255,0.055)',
    padding: 10,
    gap: 9,
  },
  projectName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  projectSummary: {
    color: COLORS.soft,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: FONT.regular,
  },
  projectStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  projectStat: {
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: COLORS.cyan,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  fileList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  filePill: {
    maxWidth: '100%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(0,0,0,0.22)',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  filePillText: {
    color: COLORS.text,
    fontSize: 9,
    fontFamily: 'monospace',
  },
  commandsText: {
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.28)',
    color: COLORS.gold,
    padding: 9,
    fontSize: 10,
    lineHeight: 15,
    fontFamily: 'monospace',
  },
  previewScreen: {
    flex: 1,
    backgroundColor: COLORS.bg,
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
  previewWebview: {
    flex: 1,
    backgroundColor: '#fff',
  },
  userText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 23,
    fontWeight: '700',
    fontFamily: FONT.semiBold,
  },
  time: {
    color: COLORS.soft,
    opacity: 0.6,
    fontSize: 10,
    paddingHorizontal: 4,
    fontFamily: FONT.regular,
  },
  timeRight: {
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  thinking: {
    backgroundColor: 'rgba(139,91,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139,91,255,0.25)',
    borderBottomLeftRadius: 5,
  },
  thinkingText: {
    color: COLORS.purple,
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 5,
    fontFamily: FONT.regular,
  },
  dots: {
    flexDirection: 'row',
    gap: 5,
    paddingVertical: 3,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.soft,
  },
  mediaStrip: {
    marginHorizontal: 14,
    marginTop: 4,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '90%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(139,91,255,0.3)',
    backgroundColor: 'rgba(139,91,255,0.1)',
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  mediaName: {
    color: '#c5b0ff',
    fontSize: 12,
    fontFamily: FONT.regular,
  },
  mediaClose: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerOuter: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
  },
  composer: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingLeft: 8,
    paddingRight: 5,
    paddingVertical: 5,
  },
  composerLight: {
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: '#ffffff',
  },
  vertexBadge: {
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: 'rgba(255,211,110,0.09)',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  vertexBadgeLight: {
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: '#fff8df',
  },
  vertexBadgeText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  vertexBadgeTextLight: {
    color: '#111827',
  },
  roundButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micActive: {
    backgroundColor: 'rgba(91,231,255,0.12)',
  },
  input: {
    flex: 1,
    maxHeight: 96,
    minHeight: 40,
    color: COLORS.text,
    fontSize: 15,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontFamily: FONT.regular,
  },
  inputLight: {
    color: '#111827',
  },
  lightTitle: {
    color: '#111827',
  },
  lightSoft: {
    color: '#667085',
  },
  sendButton: {
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    shadowColor: COLORS.indigo,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 4},
    elevation: 5,
  },
  sendText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: FONT.bold,
  },
  hintRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
    paddingTop: 4,
  },
  hint: {
    color: COLORS.soft,
    opacity: 0.45,
    fontSize: 10,
    fontFamily: FONT.regular,
  },
  counter: {
    color: COLORS.soft,
    opacity: 0.7,
    fontSize: 10,
    fontFamily: FONT.regular,
  },
  counterWarn: {
    color: '#f59e0b',
    opacity: 1,
  },
  counterLimit: {
    color: COLORS.red,
    opacity: 1,
  },
});

export default ChatScreen;
