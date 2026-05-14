import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Clipboard from '@react-native-clipboard/clipboard';
import RNFS from 'react-native-fs';
import Tts from 'react-native-tts';
import Voice from '@react-native-voice/voice';
import {
  Bot,
  Check,
  Code2,
  Copy,
  Download,
  Film,
  Globe2,
  Image as ImageIcon,
  Mic,
  Music,
  Palette,
  PenLine,
  Smartphone,
  Volume2,
} from 'lucide-react-native';
import MarkdownRenderer from '../components/MarkdownRenderer';
import {buildSystemPrompt, callChat} from '../services/api';
import {emitEvent} from '../utils/events';
import {COLORS, FONT, radius, shadow} from '../utils/theme';
import {getAvatar, saveAvatar} from '../utils/storage';

const avatarPresets = [
  {
    id: 'friendly',
    name: 'Friendly',
    hint: 'Warm Hinglish guide',
    skinTone: '#ECA97A',
    hairColor: '#1a1a1a',
    outfitColor: '#6366f1',
    eyeColor: '#2c4a8c',
    hairStyle: 'Medium',
    expression: 'Happy',
    bodyType: 'Average',
    voiceStyle: 'Hindi Friendly',
  },
  {
    id: 'teacher',
    name: 'Teacher',
    hint: 'Clear study helper',
    skinTone: '#FDDBB4',
    hairColor: '#3B2314',
    outfitColor: '#10d9a0',
    eyeColor: '#3d7a4a',
    hairStyle: 'Short',
    expression: 'Happy',
    bodyType: 'Slim',
    voiceStyle: 'English Natural',
  },
  {
    id: 'coder',
    name: 'Coder',
    hint: 'Fast technical answers',
    skinTone: '#C68642',
    hairColor: '#111111',
    outfitColor: '#1a1a2e',
    eyeColor: '#6366f1',
    hairStyle: 'Curly',
    expression: 'Cool',
    bodyType: 'Average',
    voiceStyle: 'Deep',
  },
  {
    id: 'creator',
    name: 'Creator',
    hint: 'Images, music, ideas',
    skinTone: '#FFF0F5',
    hairColor: '#D4A843',
    outfitColor: '#f43f5e',
    eyeColor: '#6B3A2A',
    hairStyle: 'Long',
    expression: 'Wow',
    bodyType: 'Slim',
    voiceStyle: 'Bright',
  },
  {
    id: 'pro',
    name: 'Pro',
    hint: 'Business and writing',
    skinTone: '#8D5524',
    hairColor: '#E8E8E8',
    outfitColor: '#f59e0b',
    eyeColor: '#111111',
    hairStyle: 'Short',
    expression: 'Serious',
    bodyType: 'Athletic',
    voiceStyle: 'English Natural',
  },
  {
    id: 'buddy',
    name: 'Buddy',
    hint: 'Casual daily support',
    skinTone: '#FDDBB4',
    hairColor: '#6366f1',
    outfitColor: '#a78bfa',
    eyeColor: '#888888',
    hairStyle: 'Medium',
    expression: 'Happy',
    bodyType: 'Average',
    voiceStyle: 'Hindi Friendly',
  },
];

const voiceSettings = {
  'Hindi Friendly': {
    language: 'hi-IN',
    fallback: 'en-IN',
    rate: 0.46,
    pitch: 1.08,
  },
  'English Natural': {
    language: 'en-IN',
    fallback: 'en-US',
    rate: 0.47,
    pitch: 1,
  },
  Deep: {language: 'en-IN', fallback: 'en-US', rate: 0.42, pitch: 0.82},
  Bright: {language: 'hi-IN', fallback: 'en-IN', rate: 0.5, pitch: 1.18},
};

const bodyWidth = {
  Slim: 104,
  Average: 124,
  Athletic: 144,
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

const defaultAvatar = avatarPresets[0];

const toolPayloadText = tool =>
  tool?.output || tool?.url || tool?.prompt || 'Generated output';

const saveToolOutput = async tool => {
  if (!tool) {
    return;
  }
  const ext =
    tool.type === 'image'
      ? 'png'
      : ['website', 'app'].includes(tool.type)
      ? 'html'
      : 'txt';
  const target = `${
    RNFS.DownloadDirectoryPath || RNFS.DocumentDirectoryPath
  }/vertex-avatar-${tool.type || 'tool'}-${Date.now()}.${ext}`;
  try {
    if (tool.type === 'image' && tool.url) {
      await RNFS.downloadFile({fromUrl: tool.url, toFile: target}).promise;
    } else {
      await RNFS.writeFile(target, toolPayloadText(tool), 'utf8');
    }
    emitEvent('toast', 'Tool output saved');
  } catch {
    emitEvent('toast', 'Download failed');
  }
};

const AvatarToolCard = ({tool}) => {
  if (!tool) {
    return null;
  }
  const Icon = toolIcons[tool.type] || Bot;
  return (
    <View style={styles.avatarToolCard}>
      <View style={styles.avatarToolHeader}>
        <View style={styles.avatarToolTitleRow}>
          <View style={styles.avatarToolIcon}>
            <Icon size={15} color={COLORS.gold} />
          </View>
          <View style={styles.avatarToolTextWrap}>
            <Text style={styles.avatarToolTitle}>
              {tool.title || 'Task Output'}
            </Text>
            {tool.prompt ? (
              <Text style={styles.avatarToolPrompt} numberOfLines={2}>
                {tool.prompt}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.avatarToolActions}>
          <Pressable
            style={styles.avatarToolAction}
            onPress={() => {
              Clipboard.setString(toolPayloadText(tool));
              emitEvent('toast', 'Tool output copied');
            }}>
            <Copy size={12} color={COLORS.soft} />
          </Pressable>
          <Pressable
            style={styles.avatarToolAction}
            onPress={() => saveToolOutput(tool)}>
            <Download size={12} color={COLORS.soft} />
          </Pressable>
        </View>
      </View>
      {tool.type === 'image' && tool.url ? (
        <Image
          source={{uri: tool.url}}
          style={styles.avatarToolImage}
          resizeMode="cover"
        />
      ) : null}
      {tool.output ? (
        <View style={styles.avatarToolOutput}>
          <MarkdownRenderer content={tool.output} />
        </View>
      ) : null}
    </View>
  );
};

const AvatarFigure = ({avatar, mouth, idle}) => {
  const mouthHeight = mouth.interpolate({
    inputRange: [0, 1],
    outputRange: avatar.expression === 'Wow' ? [15, 34] : [5, 24],
  });
  const mouthWidth = mouth.interpolate({
    inputRange: [0, 1],
    outputRange: avatar.expression === 'Wow' ? [18, 27] : [37, 25],
  });
  const bob = idle.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -9],
  });
  const handWave = idle.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-18deg', '10deg', '-18deg'],
  });
  const isCool = avatar.expression === 'Cool';
  const isSerious = avatar.expression === 'Serious';
  const isLong = avatar.hairStyle === 'Long';
  const isCurly = avatar.hairStyle === 'Curly';

  return (
    <Animated.View style={[styles.figure, {transform: [{translateY: bob}]}]}>
      <View style={styles.avatarGlow} />
      <View style={styles.legs}>
        <View style={[styles.leg, {backgroundColor: avatar.outfitColor}]} />
        <View style={[styles.leg, {backgroundColor: avatar.outfitColor}]} />
      </View>
      <View style={styles.bodyWrap}>
        <View
          style={[
            styles.arm,
            styles.leftArm,
            {
              backgroundColor: avatar.outfitColor,
              transform: [{rotate: '-20deg'}],
            },
          ]}>
          <View style={[styles.hand, {backgroundColor: avatar.skinTone}]} />
        </View>
        <Animated.View
          style={[
            styles.arm,
            styles.rightArm,
            {
              backgroundColor: avatar.outfitColor,
              transform: [{rotate: handWave}],
            },
          ]}>
          <View style={[styles.hand, {backgroundColor: avatar.skinTone}]} />
        </Animated.View>
        <LinearGradient
          colors={[avatar.outfitColor, '#171927']}
          style={[styles.torso, {width: bodyWidth[avatar.bodyType]}]}>
          <View style={styles.collar} />
          <View style={styles.tie} />
        </LinearGradient>
      </View>
      <View style={[styles.neck, {backgroundColor: avatar.skinTone}]} />
      <View style={styles.headWrap}>
        {isLong ? (
          <View
            style={[styles.longHairBack, {backgroundColor: avatar.hairColor}]}
          />
        ) : null}
        <View
          style={[
            styles.ear,
            styles.leftEar,
            {backgroundColor: avatar.skinTone},
          ]}
        />
        <View
          style={[
            styles.ear,
            styles.rightEar,
            {backgroundColor: avatar.skinTone},
          ]}
        />
        <LinearGradient
          colors={[avatar.skinTone, '#f6c493']}
          style={styles.head}>
          <View
            style={[
              styles.hairCap,
              {backgroundColor: avatar.hairColor},
              isLong && styles.longHair,
            ]}
          />
          {isCurly ? (
            <View style={styles.curlRow}>
              {[0, 1, 2, 3, 4].map(index => (
                <View
                  key={index}
                  style={[styles.curl, {backgroundColor: avatar.hairColor}]}
                />
              ))}
            </View>
          ) : (
            <View style={[styles.bang, {backgroundColor: avatar.hairColor}]} />
          )}
          <View style={styles.browRow}>
            <View
              style={[
                styles.brow,
                {backgroundColor: avatar.hairColor},
                isSerious && styles.browSeriousLeft,
              ]}
            />
            <View
              style={[
                styles.brow,
                {backgroundColor: avatar.hairColor},
                isSerious && styles.browSeriousRight,
              ]}
            />
          </View>
          {isCool ? (
            <View style={styles.glassesRow}>
              <View style={styles.glass} />
              <View style={styles.glassBridge} />
              <View style={styles.glass} />
            </View>
          ) : (
            <View style={styles.eyeRow}>
              {[0, 1].map(index => (
                <View key={index} style={styles.eye}>
                  <View
                    style={[styles.iris, {backgroundColor: avatar.eyeColor}]}>
                    <View style={styles.pupil} />
                    <View style={styles.eyeShine} />
                  </View>
                </View>
              ))}
            </View>
          )}
          <View style={styles.nose} />
          <View style={styles.cheekRow}>
            <View style={styles.cheek} />
            <View style={styles.cheek} />
          </View>
          <Animated.View
            style={[
              styles.mouth,
              avatar.expression === 'Wow' && styles.wowMouth,
              avatar.expression === 'Serious' && styles.seriousMouth,
              {height: mouthHeight, width: mouthWidth},
            ]}>
            <View style={styles.mouthHighlight} />
          </Animated.View>
        </LinearGradient>
      </View>
    </Animated.View>
  );
};

const AvatarScreen = ({selectedModel = 'vertex', themeMode = 'dark'}) => {
  const [avatar, setAvatar] = useState(defaultAvatar);
  const [heardText, setHeardText] = useState('');
  const [reply, setReply] = useState(
    'Namaste, main aapka voice avatar hoon. Mic dabao aur bolna shuru karo.',
  );
  const [replyTool, setReplyTool] = useState(null);
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const mouth = useRef(new Animated.Value(0)).current;
  const idle = useRef(new Animated.Value(0)).current;
  const mouthLoop = useRef(null);
  const speechTimer = useRef(null);
  const heardRef = useRef('');
  const askLock = useRef(false);
  const loadingRef = useRef(false);
  const greeted = useRef(false);
  const isLight = themeMode === 'light';

  const applyVoice = useCallback(async () => {
    const settings =
      voiceSettings[avatar.voiceStyle] || voiceSettings['Hindi Friendly'];
    await Tts.setDefaultLanguage(settings.language).catch(() =>
      Tts.setDefaultLanguage(settings.fallback).catch(() => {}),
    );
    await Tts.setDefaultRate(settings.rate, true).catch(() => {});
    await Tts.setDefaultPitch(settings.pitch).catch(() => {});
  }, [avatar.voiceStyle]);

  const stopMouth = useCallback(() => {
    clearTimeout(speechTimer.current);
    mouthLoop.current?.stop();
    Animated.timing(mouth, {
      toValue: 0,
      duration: 160,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
    setSpeaking(false);
  }, [mouth]);

  const startMouth = useCallback(() => {
    clearTimeout(speechTimer.current);
    setSpeaking(true);
    mouthLoop.current?.stop();
    mouthLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(mouth, {
          toValue: 1,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(mouth, {
          toValue: 0.2,
          duration: 95,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(mouth, {
          toValue: 0.85,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(mouth, {
          toValue: 0,
          duration: 130,
          easing: Easing.in(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    mouthLoop.current.start();
  }, [mouth]);

  const speakText = useCallback(
    async text => {
      const clean = String(text || '')
        .replace(/[*_`#>]/g, '')
        .trim();
      if (!clean) {
        return;
      }
      await applyVoice();
      Tts.stop();
      startMouth();
      speechTimer.current = setTimeout(
        stopMouth,
        Math.min(18000, 1400 + clean.length * 58),
      );
      Tts.speak(clean.slice(0, 1200));
    },
    [applyVoice, startMouth, stopMouth],
  );

  const askAvatar = useCallback(
    async text => {
      const finalText = String(text || '').trim();
      if (!finalText || loadingRef.current) {
        return;
      }
      loadingRef.current = true;
      setLoading(true);
      setHeardText(finalText);
      try {
        const result = await callChat({
          history: [{role: 'user', content: finalText}],
          systemPrompt: buildSystemPrompt(
            'You are a full-screen talking human avatar inside Vertex AI. User speaks by voice. Reply like a helpful friend. Keep answers short enough for voice output. If user asks for image, music, video, website, app, code, or writing, complete the task using markdown/tool output. Never mention the underlying AI provider.',
          ),
          provider: selectedModel,
        });
        setReply(result.reply);
        setReplyTool(result.tool);
        await speakText(result.reply);
      } catch (error) {
        const fallback = `Backend connect nahi hua: ${error.message}`;
        setReply(fallback);
        setReplyTool(null);
        emitEvent('toast', 'Avatar AI backend check karo');
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [selectedModel, speakText],
  );

  useEffect(() => {
    getAvatar().then(saved => {
      if (saved) {
        setAvatar({...defaultAvatar, ...saved});
      }
    });
    Animated.loop(
      Animated.sequence([
        Animated.timing(idle, {
          toValue: 1,
          duration: 1900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(idle, {
          toValue: 0,
          duration: 1900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    ).start();

    Voice.onSpeechResults = event => {
      const text = event.value?.[0] || '';
      heardRef.current = text;
      setHeardText(text);
    };
    Voice.onSpeechEnd = () => {
      setListening(false);
      const text = heardRef.current.trim();
      if (text && !askLock.current) {
        askLock.current = true;
        setTimeout(() => {
          askAvatar(text).finally(() => {
            askLock.current = false;
          });
        }, 160);
      }
    };
    Voice.onSpeechError = () => {
      setListening(false);
      askLock.current = false;
    };
    const startSub = Tts.addEventListener('tts-start', startMouth);
    const finishSub = Tts.addEventListener('tts-finish', stopMouth);
    const cancelSub = Tts.addEventListener('tts-cancel', stopMouth);
    return () => {
      startSub?.remove?.();
      finishSub?.remove?.();
      cancelSub?.remove?.();
      clearTimeout(speechTimer.current);
      mouthLoop.current?.stop();
      Tts.stop();
      Voice.destroy()
        .then(() => Voice.removeAllListeners())
        .catch(() => {});
    };
  }, [askAvatar, idle, startMouth, stopMouth]);

  useEffect(() => {
    applyVoice();
  }, [applyVoice]);

  useEffect(() => {
    if (greeted.current) {
      return;
    }
    greeted.current = true;
    const timer = setTimeout(() => {
      speakText(
        `Namaste, main ${avatar.name} voice avatar hoon. Mic dabao, main sun raha hoon.`,
      );
    }, 850);
    return () => clearTimeout(timer);
  }, [avatar.name, speakText]);

  const startListening = async () => {
    try {
      await Tts.stop();
      stopMouth();
      heardRef.current = '';
      setHeardText('');
      setReplyTool(null);
      setListening(true);
      await Voice.start('hi-IN');
    } catch {
      setListening(false);
      emitEvent('toast', 'Voice input start nahi hua');
    }
  };

  const selectAvatar = async preset => {
    const next = {...preset};
    setAvatar(next);
    await saveAvatar(next);
    setPickerOpen(false);
    setReply(`${preset.name} avatar ready hai. Aap bol sakte ho.`);
    speakText(`${preset.name} avatar ready hai. Aap boliye.`);
  };

  const statusText = useMemo(() => {
    if (loading) {
      return 'Thinking...';
    }
    if (speaking) {
      return 'Speaking';
    }
    if (listening) {
      return 'Listening...';
    }
    return 'Tap mic and speak';
  }, [listening, loading, speaking]);

  return (
    <View style={[styles.screen, isLight && styles.screenLight]}>
      <View style={styles.stage}>
        <View style={styles.topRow}>
          <View style={styles.statusPill}>
            <View
              style={[styles.statusDot, speaking && styles.statusDotLive]}
            />
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
          <Pressable
            onPress={() => setPickerOpen(value => !value)}
            style={styles.changeButton}>
            <Palette size={15} color={COLORS.text} />
            <Text style={styles.changeText}>Avatars</Text>
          </Pressable>
        </View>

        <AvatarFigure avatar={avatar} mouth={mouth} idle={idle} />

        <View style={styles.namePlate}>
          <Text style={styles.avatarName}>{avatar.name}</Text>
          <Text style={styles.avatarHint}>{avatar.hint}</Text>
        </View>
      </View>

      {pickerOpen ? (
        <View style={[styles.pickerPanel, isLight && styles.pickerPanelLight]}>
          <Text style={[styles.pickerTitle, isLight && styles.textDark]}>
            Choose avatar
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetRow}>
            {avatarPresets.map(preset => {
              const active = preset.id === avatar.id;
              return (
                <Pressable
                  key={preset.id}
                  onPress={() => selectAvatar(preset)}
                  style={[
                    styles.presetCard,
                    active && styles.presetCardActive,
                    isLight && styles.presetCardLight,
                  ]}>
                  <View
                    style={[
                      styles.presetHead,
                      {backgroundColor: preset.skinTone},
                    ]}>
                    <View
                      style={[
                        styles.presetHair,
                        {backgroundColor: preset.hairColor},
                      ]}
                    />
                    <View style={styles.presetEyes} />
                  </View>
                  <Text style={[styles.presetName, isLight && styles.textDark]}>
                    {preset.name}
                  </Text>
                  {active ? (
                    <View style={styles.checkBadge}>
                      <Check size={12} color="#111" />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <View style={[styles.voicePanel, isLight && styles.voicePanelLight]}>
        <Text style={[styles.replyLabel, isLight && styles.textDark]}>
          Voice conversation
        </Text>
        <ScrollView
          style={styles.replyScroll}
          showsVerticalScrollIndicator={false}>
          {heardText ? (
            <Text style={styles.heardText}>You said: {heardText}</Text>
          ) : null}
          <Text style={[styles.replyText, isLight && styles.replyTextLight]}>
            {reply}
          </Text>
          <AvatarToolCard tool={replyTool} />
        </ScrollView>

        <View style={styles.voiceActions}>
          <Pressable
            onPress={startListening}
            disabled={loading || speaking}
            style={[
              styles.bigMic,
              listening && styles.bigMicLive,
              (loading || speaking) && styles.bigMicDisabled,
            ]}>
            <Mic size={30} color="#111" />
          </Pressable>
          <Pressable
            onPress={() => speakText(reply)}
            style={styles.replayButton}>
            <Volume2 size={18} color={COLORS.text} />
            <Text style={styles.replayText}>Replay</Text>
          </Pressable>
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
  screenLight: {
    backgroundColor: '#f6f7fb',
  },
  stage: {
    flex: 1,
    minHeight: 420,
    backgroundColor: '#07080d',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  topRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  statusPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.24)',
    backgroundColor: 'rgba(74,222,128,0.08)',
    paddingHorizontal: 11,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.green,
  },
  statusDotLive: {
    backgroundColor: COLORS.gold,
  },
  statusText: {
    color: COLORS.green,
    fontSize: 11,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  changeButton: {
    minHeight: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  changeText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  namePlate: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(0,0,0,0.36)',
    padding: 12,
    alignItems: 'center',
  },
  avatarName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  avatarHint: {
    color: COLORS.soft,
    fontSize: 12,
    marginTop: 2,
    fontFamily: FONT.regular,
  },
  pickerPanel: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
    paddingVertical: 12,
  },
  pickerPanelLight: {
    backgroundColor: '#ffffff',
    borderTopColor: 'rgba(0,0,0,0.10)',
  },
  pickerTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
    paddingHorizontal: 14,
    marginBottom: 9,
  },
  presetRow: {
    gap: 10,
    paddingHorizontal: 14,
  },
  presetCard: {
    width: 92,
    minHeight: 108,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.045)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    position: 'relative',
  },
  presetCardLight: {
    backgroundColor: '#f6f7fb',
    borderColor: 'rgba(0,0,0,0.10)',
  },
  presetCardActive: {
    borderColor: COLORS.gold,
  },
  presetHead: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    alignItems: 'center',
  },
  presetHair: {
    width: 54,
    height: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  presetEyes: {
    width: 24,
    height: 7,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderColor: '#111',
    marginTop: 9,
  },
  presetName: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  checkBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voicePanel: {
    maxHeight: '42%',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: 14,
    gap: 10,
  },
  voicePanelLight: {
    backgroundColor: '#ffffff',
    borderTopColor: 'rgba(0,0,0,0.10)',
  },
  replyLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  textDark: {
    color: '#111827',
  },
  replyScroll: {
    maxHeight: 136,
  },
  heardText: {
    color: COLORS.cyan,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
    fontFamily: FONT.semiBold,
  },
  replyText: {
    color: COLORS.soft,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONT.regular,
  },
  replyTextLight: {
    color: '#475467',
  },
  voiceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  bigMic: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.glowPurple,
  },
  bigMicLive: {
    backgroundColor: COLORS.green,
  },
  bigMicDisabled: {
    opacity: 0.55,
  },
  replayButton: {
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  replayText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  avatarToolCard: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,211,110,0.18)',
    backgroundColor: 'rgba(5,5,7,0.48)',
    overflow: 'hidden',
  },
  avatarToolHeader: {
    minHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  avatarToolTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarToolIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,211,110,0.12)',
  },
  avatarToolTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  avatarToolTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  avatarToolPrompt: {
    color: COLORS.soft,
    fontSize: 10,
    marginTop: 2,
    fontFamily: FONT.regular,
  },
  avatarToolActions: {
    flexDirection: 'row',
    gap: 5,
  },
  avatarToolAction: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  avatarToolImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  avatarToolOutput: {
    padding: 10,
  },
  avatarGlow: {
    position: 'absolute',
    bottom: 28,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(91,231,255,0.07)',
  },
  figure: {
    width: 290,
    height: 372,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  legs: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    gap: 18,
  },
  leg: {
    width: 28,
    height: 96,
    borderRadius: 15,
    opacity: 0.9,
  },
  bodyWrap: {
    position: 'absolute',
    bottom: 72,
    width: 230,
    height: 130,
    alignItems: 'center',
  },
  torso: {
    height: 130,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  collar: {
    width: 70,
    height: 28,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  tie: {
    width: 16,
    height: 64,
    borderRadius: 8,
    backgroundColor: 'rgba(91,231,255,0.9)',
    marginTop: -3,
  },
  arm: {
    position: 'absolute',
    top: 16,
    width: 25,
    height: 112,
    borderRadius: 14,
    zIndex: 0,
  },
  leftArm: {
    left: 32,
  },
  rightArm: {
    right: 32,
  },
  hand: {
    position: 'absolute',
    bottom: -12,
    left: -3,
    width: 31,
    height: 31,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  neck: {
    position: 'absolute',
    bottom: 193,
    width: 38,
    height: 42,
    borderRadius: 18,
    zIndex: 2,
  },
  headWrap: {
    position: 'absolute',
    bottom: 218,
    width: 186,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  head: {
    width: 146,
    height: 142,
    borderRadius: 64,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  ear: {
    position: 'absolute',
    top: 59,
    width: 26,
    height: 34,
    borderRadius: 16,
    zIndex: 0,
  },
  leftEar: {
    left: 10,
  },
  rightEar: {
    right: 10,
  },
  longHairBack: {
    position: 'absolute',
    top: -2,
    width: 160,
    height: 160,
    borderRadius: 58,
    zIndex: -1,
  },
  hairCap: {
    position: 'absolute',
    top: -10,
    width: 150,
    height: 58,
    borderBottomLeftRadius: 52,
    borderBottomRightRadius: 52,
    zIndex: 5,
  },
  longHair: {
    height: 70,
  },
  bang: {
    position: 'absolute',
    top: 20,
    left: 28,
    width: 74,
    height: 35,
    borderBottomRightRadius: 38,
    borderTopLeftRadius: 20,
    transform: [{rotate: '-12deg'}],
    zIndex: 7,
  },
  curlRow: {
    position: 'absolute',
    top: 14,
    left: 23,
    right: 23,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 8,
  },
  curl: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  browRow: {
    marginTop: 54,
    width: 88,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 9,
  },
  brow: {
    width: 30,
    height: 6,
    borderRadius: 4,
  },
  browSeriousLeft: {
    transform: [{rotate: '12deg'}],
  },
  browSeriousRight: {
    transform: [{rotate: '-12deg'}],
  },
  eyeRow: {
    marginTop: 7,
    width: 86,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 9,
  },
  eye: {
    width: 29,
    height: 30,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iris: {
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pupil: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#08080a',
  },
  eyeShine: {
    position: 'absolute',
    top: 3,
    right: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ffffff',
  },
  glassesRow: {
    marginTop: 9,
    width: 94,
    height: 29,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  glass: {
    width: 36,
    height: 24,
    borderRadius: 9,
    backgroundColor: '#101014',
    borderWidth: 2,
    borderColor: '#333340',
  },
  glassBridge: {
    width: 12,
    height: 4,
    backgroundColor: '#333340',
  },
  nose: {
    marginTop: 4,
    width: 18,
    height: 24,
    borderRadius: 10,
    backgroundColor: 'rgba(196,104,70,0.27)',
    zIndex: 9,
  },
  cheekRow: {
    position: 'absolute',
    top: 92,
    width: 112,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 9,
  },
  cheek: {
    width: 20,
    height: 11,
    borderRadius: 10,
    backgroundColor: 'rgba(244,114,182,0.24)',
  },
  mouth: {
    marginTop: 4,
    borderRadius: 18,
    backgroundColor: '#3a1017',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    overflow: 'hidden',
    zIndex: 11,
  },
  wowMouth: {
    borderRadius: 18,
  },
  seriousMouth: {
    borderRadius: 5,
  },
  mouthHighlight: {
    width: 20,
    height: 4,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.24)',
    marginTop: 3,
  },
});

export default AvatarScreen;
