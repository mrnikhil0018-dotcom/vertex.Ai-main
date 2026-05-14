import React, {useEffect, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  Bot,
  Download,
  Grid3X3,
  LogOut,
  MessageCircle,
  Moon,
  Plus,
  Settings,
  Trash2,
  UserCircle,
  Volume2,
  X,
} from 'lucide-react-native';
import {emitEvent} from '../utils/events';
import {COLORS, FONT, GRADIENTS, radius} from '../utils/theme';
import {deleteChat, getChats, savePrefs} from '../utils/storage';

const pageLinks = [
  {label: 'Chat', screen: 'chat', Icon: MessageCircle},
  {label: 'Tools', screen: 'tools', Icon: Grid3X3},
  {label: 'Avatar', screen: 'avatar', Icon: UserCircle},
];

const RowButton = ({Icon, label, danger, active, onPress, textColor}) => (
  <Pressable
    onPress={onPress}
    style={({pressed}) => [
      styles.rowButton,
      active && styles.activeRow,
      danger && styles.dangerButton,
      pressed && {opacity: 0.75},
    ]}>
    <Icon
      size={15}
      color={
        danger ? COLORS.red : active ? COLORS.cyan : textColor || COLORS.text
      }
    />
    <Text
      style={[
        styles.rowText,
        textColor ? {color: textColor} : null,
        active && styles.activeText,
        danger && styles.dangerText,
      ]}>
      {label}
    </Text>
  </Pressable>
);

const MenuPanel = ({
  visible,
  onClose,
  user,
  onLogout,
  preferences,
  setPreferences,
  activeScreen,
  onNavigate,
}) => {
  const [chats, setChats] = useState([]);
  const slide = useRef(new Animated.Value(340)).current;
  const isDark = preferences.darkTheme !== false;
  const textColor = isDark ? COLORS.text : '#111827';
  const softColor = isDark ? COLORS.soft : '#667085';

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 0 : 340,
      duration: 280,
      useNativeDriver: true,
    }).start();
    if (visible) {
      refresh();
    }
  }, [visible, slide]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (visible) {
        refresh();
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [visible]);

  const refresh = async () => {
    setChats((await getChats()).slice(0, 8));
  };

  const togglePref = async key => {
    const next = {...preferences, [key]: !preferences[key]};
    setPreferences(next);
    await savePrefs(next);
  };

  const goToChat = () => {
    onNavigate('chat');
  };

  const removeChat = chat => {
    Alert.alert('Delete chat?', chat.preview || 'This chat', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteChat(chat.id);
          emitEvent('chat:deleted', chat.id);
          refresh();
        },
      },
    ]);
  };

  const userName = user?.name || 'User';
  const initial = userName.trim().charAt(0).toUpperCase() || 'V';

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.shade} onPress={onClose} />
      <Animated.View
        style={[
          styles.panel,
          !isDark && styles.panelLight,
          {transform: [{translateX: slide}]},
        ]}>
        <View style={styles.header}>
          <Text style={[styles.headerLabel, !isDark && {color: softColor}]}>
            Menu
          </Text>
          <Pressable onPress={onClose} style={styles.close}>
            <X size={15} color={textColor} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}>
          <View style={styles.profileCard}>
            <LinearGradient colors={GRADIENTS.gold} style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </LinearGradient>
            <View style={styles.profileText}>
              <View style={styles.nameRow}>
                <Text
                  style={[styles.profileName, {color: textColor}]}
                  numberOfLines={1}>
                  {userName}
                </Text>
                <View style={styles.proBadge}>
                  <Text style={styles.proText}>PRO</Text>
                </View>
              </View>
              <Text
                style={[styles.profileEmail, {color: softColor}]}
                numberOfLines={1}>
                {user?.email || '-'}
              </Text>
            </View>
          </View>

          <Text style={[styles.section, {color: softColor}]}>Quick Action</Text>
          <RowButton
            Icon={Plus}
            label="New Chat"
            textColor={textColor}
            onPress={() => {
              goToChat();
              setTimeout(() => emitEvent('chat:new'), 80);
            }}
          />

          <Text style={[styles.section, {color: softColor}]}>Pages</Text>
          {pageLinks.map(item => (
            <RowButton
              key={item.screen}
              Icon={item.Icon}
              label={item.label}
              active={activeScreen === item.screen}
              textColor={textColor}
              onPress={() => onNavigate(item.screen)}
            />
          ))}

          <Text style={[styles.section, {color: softColor}]}>Recent Chats</Text>
          {chats.length ? (
            chats.map(chat => (
              <View key={chat.id} style={styles.chatRow}>
                <Pressable
                  style={styles.chatButton}
                  onPress={() => {
                    goToChat();
                    setTimeout(() => emitEvent('chat:load', chat), 80);
                  }}>
                  <MessageCircle size={13} color={COLORS.soft} />
                  <View style={styles.chatTextWrap}>
                    <Text
                      style={[styles.chatPreview, {color: textColor}]}
                      numberOfLines={1}>
                      {chat.preview || 'Chat'}
                    </Text>
                    <Text style={[styles.chatDate, {color: softColor}]}>
                      {chat.date}
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  style={styles.deleteChatButton}
                  onPress={() => removeChat(chat)}>
                  <Trash2 size={13} color={COLORS.red} />
                </Pressable>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, {color: softColor}]}>
              No recent chats yet.
            </Text>
          )}

          <Text style={[styles.section, {color: softColor}]}>Chat Options</Text>
          <RowButton
            Icon={Bot}
            label="System Prompt"
            textColor={textColor}
            onPress={() => {
              goToChat();
              setTimeout(() => emitEvent('chat:system'), 80);
            }}
          />
          <RowButton
            Icon={Download}
            label="Export Chat"
            textColor={textColor}
            onPress={() => {
              goToChat();
              setTimeout(() => emitEvent('chat:export'), 80);
            }}
          />

          <Text style={[styles.section, {color: softColor}]}>Preferences</Text>
          {[
            ['voiceOutput', 'Voice Output', Volume2],
            [
              'darkTheme',
              preferences.darkTheme ? 'Dark Theme' : 'Light Theme',
              Moon,
            ],
            ['rememberMe', 'Remember Me', Settings],
          ].map(([key, label, Icon]) => (
            <View key={key} style={styles.prefRow}>
              <View style={styles.prefLeft}>
                <Icon size={15} color={textColor} />
                <Text style={[styles.prefText, {color: textColor}]}>
                  {label}
                </Text>
              </View>
              <Switch
                value={Boolean(preferences[key])}
                onValueChange={() => togglePref(key)}
                trackColor={{
                  false: 'rgba(255,255,255,0.12)',
                  true: COLORS.purple,
                }}
                thumbColor={
                  preferences[key] ? '#fff' : 'rgba(255,255,255,0.38)'
                }
              />
            </View>
          ))}

          <RowButton
            Icon={LogOut}
            label="Logout"
            danger
            onPress={onLogout}
            textColor={textColor}
          />
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
  },
  shade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  panel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 330,
    maxWidth: '100%',
    backgroundColor: COLORS.panel,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
  },
  panelLight: {
    backgroundColor: '#ffffff',
    borderLeftColor: 'rgba(0,0,0,0.10)',
  },
  header: {
    height: 55,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLabel: {
    color: COLORS.soft,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: FONT.extraBold,
  },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 8,
    paddingBottom: 28,
    gap: 3,
  },
  section: {
    color: COLORS.soft,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontWeight: '900',
    fontFamily: FONT.extraBold,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 4,
  },
  profileCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#111',
    fontWeight: '900',
    fontSize: 16,
    fontFamily: FONT.extraBold,
  },
  profileText: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileName: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  profileEmail: {
    color: COLORS.soft,
    fontSize: 11,
    marginTop: 2,
    fontFamily: FONT.regular,
  },
  proBadge: {
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,211,110,0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  proText: {
    color: COLORS.gold,
    fontSize: 9,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  rowButton: {
    minHeight: 40,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  activeRow: {
    backgroundColor: 'rgba(91,231,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(91,231,255,0.20)',
  },
  dangerButton: {
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.38)',
    backgroundColor: 'rgba(248,113,113,0.07)',
    marginTop: 8,
  },
  rowText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONT.semiBold,
  },
  activeText: {
    color: COLORS.cyan,
  },
  dangerText: {
    color: COLORS.red,
  },
  chatRow: {
    minHeight: 44,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.025)',
    overflow: 'hidden',
  },
  chatButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 12,
    paddingRight: 6,
  },
  chatTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  chatPreview: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONT.semiBold,
  },
  chatDate: {
    color: COLORS.soft,
    fontSize: 10,
    fontFamily: FONT.regular,
  },
  deleteChatButton: {
    width: 42,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: COLORS.soft,
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: FONT.regular,
  },
  backendCard: {
    marginHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.22)',
    backgroundColor: 'rgba(74,222,128,0.07)',
    padding: 11,
    flexDirection: 'row',
    gap: 10,
  },
  backendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.green,
    marginTop: 5,
  },
  backendTitle: {
    color: COLORS.green,
    fontSize: 12,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  backendText: {
    color: COLORS.soft,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 2,
    fontFamily: FONT.regular,
  },
  prefRow: {
    minHeight: 45,
    borderRadius: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prefLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  prefText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONT.semiBold,
  },
});

export default MenuPanel;
