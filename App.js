import 'react-native-gesture-handler';
import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {Menu, UserCircle} from 'lucide-react-native';
import GradientText from './src/components/GradientText';
import AvatarScreen from './src/screens/AvatarScreen';
import ChatScreen from './src/screens/ChatScreen';
import LoginScreen from './src/screens/LoginScreen';
import MenuPanel from './src/screens/MenuPanel';
import ToolsScreen from './src/screens/ToolsScreen';
import {apiRequest} from './src/services/api';
import {onEvent} from './src/utils/events';
import {COLORS, FONT, GRADIENTS, shadow} from './src/utils/theme';
import {clearAuth, getPrefs, getToken, getUser} from './src/utils/storage';

const Toast = () => {
  const [message, setMessage] = useState('');
  const translateY = useRef(new Animated.Value(80)).current;
  const timer = useRef(null);

  useEffect(() => {
    const off = onEvent('toast', text => {
      setMessage(text);
      clearTimeout(timer.current);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      timer.current = setTimeout(() => {
        Animated.timing(translateY, {
          toValue: 80,
          duration: 240,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }, 2200);
    });
    return () => {
      off();
      clearTimeout(timer.current);
    };
  }, [translateY]);

  if (!message) {
    return null;
  }
  return (
    <Animated.View style={[styles.toast, {transform: [{translateY}]}]}>
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
};

const TopBar = ({onMenu, activeScreen, isDark}) => (
  <View style={[styles.topbar, !isDark && styles.topbarLight]}>
    <View style={styles.topLeft}>
      <Pressable onPress={onMenu} style={styles.menuButton}>
        <Menu size={19} color={isDark ? COLORS.text : '#15151c'} />
      </Pressable>
      <View>
        <GradientText style={styles.brand}>vertex.ai</GradientText>
        <Text style={[styles.screenLabel, !isDark && styles.screenLabelLight]}>
          {activeScreen === 'tools'
            ? 'AI Tools'
            : activeScreen === 'avatar'
            ? 'Talking Avatar'
            : 'Chat Workspace'}
        </Text>
      </View>
    </View>
    <Pressable onPress={onMenu} style={styles.profileButton}>
      <UserCircle size={18} color={isDark ? COLORS.text : '#15151c'} />
    </Pressable>
  </View>
);

const MainApp = ({user, onLogout}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeScreen, setActiveScreen] = useState('chat');
  const [preferences, setPreferences] = useState({
    voiceOutput: false,
    darkTheme: true,
    rememberMe: true,
    aiModel: 'vertex',
  });

  useEffect(() => {
    getPrefs().then(setPreferences);
  }, []);

  const isDark = preferences.darkTheme !== false;

  const logout = async () => {
    setMenuOpen(false);
    await clearAuth();
    onLogout();
  };

  return (
    <SafeAreaView
      style={[styles.shell, !isDark && styles.shellLight]}
      edges={['top']}>
      <TopBar
        activeScreen={activeScreen}
        isDark={isDark}
        onMenu={() => setMenuOpen(true)}
      />
      <View style={styles.content}>
        {activeScreen === 'avatar' ? (
          <AvatarScreen themeMode={isDark ? 'dark' : 'light'} />
        ) : activeScreen === 'tools' ? (
          <ToolsScreen themeMode={isDark ? 'dark' : 'light'} />
        ) : (
          <ChatScreen
            user={user}
            themeMode={isDark ? 'dark' : 'light'}
            voiceOutput={preferences.voiceOutput}
          />
        )}
      </View>
      <MenuPanel
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={user}
        onLogout={logout}
        preferences={preferences}
        setPreferences={setPreferences}
        activeScreen={activeScreen}
        onNavigate={screen => {
          setActiveScreen(screen);
          setMenuOpen(false);
        }}
      />
      <Toast />
    </SafeAreaView>
  );
};

const App = () => {
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const boot = async () => {
      const [token, storedUser] = await Promise.all([getToken(), getUser()]);
      if (token && storedUser) {
        setUser(storedUser);
        try {
          const session = await apiRequest('/auth/me', {timeout: 2500});
          setUser(session.user || storedUser);
        } catch {}
      }
      setLoading(false);
      setTimeout(() => setShowSplash(false), 900);
    };
    boot();
  }, []);

  if (loading || showSplash) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <LinearGradient colors={['#050507', '#0d0f16']} style={styles.loading}>
          <LinearGradient
            colors={GRADIENTS.logo}
            style={[styles.loadingLogo, shadow.glowPurple]}>
            <Text style={styles.logoLetter}>V</Text>
          </LinearGradient>
          <GradientText style={styles.loadingText}>vertex.ai</GradientText>
          <Text style={styles.loadingSub}>AI workspace loading...</Text>
        </LinearGradient>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        {user ? (
          <MainApp user={user} onLogout={() => setUser(null)} />
        ) : (
          <LoginScreen onAuthSuccess={setUser} />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  shell: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  shellLight: {
    backgroundColor: '#f6f7fb',
  },
  topbar: {
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: 'rgba(5,5,7,0.94)',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topbarLight: {
    borderBottomColor: 'rgba(0,0,0,0.10)',
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  brand: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
    textTransform: 'lowercase',
  },
  screenLabel: {
    color: COLORS.soft,
    fontSize: 10,
    marginTop: -1,
    fontFamily: FONT.semiBold,
  },
  screenLabelLight: {
    color: '#667085',
  },
  content: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loadingLogo: {
    width: 74,
    height: 74,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    color: '#111',
    fontSize: 34,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  loadingText: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  loadingSub: {
    color: COLORS.soft,
    fontSize: 12,
    fontFamily: FONT.semiBold,
  },
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
    zIndex: 100,
    alignItems: 'center',
  },
  toastText: {
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: 'rgba(20,20,30,0.97)',
    color: COLORS.text,
    paddingHorizontal: 18,
    paddingVertical: 11,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONT.semiBold,
  },
});

export default App;
