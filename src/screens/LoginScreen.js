import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {WebView} from 'react-native-webview';
import {
  Apple,
  Check,
  Chrome,
  Eye,
  EyeOff,
  Github,
  Lock,
  Mail,
  Monitor,
  User,
  X,
} from 'lucide-react-native';
import GradientText from '../components/GradientText';
import {getOAuthStartUrl} from '../services/api';
import {IS_CLOUD_BACKEND_CONFIGURED} from '../backendConfig';
import {supabaseLogin, supabaseSignup} from '../services/supabaseAuth';
import {COLORS, FONT, GRADIENTS, radius, shadow} from '../utils/theme';
import {getPrefs, savePrefs, saveUser} from '../utils/storage';

const socialProviders = [
  {provider: 'google', name: 'Google', Icon: Chrome},
  {provider: 'github', name: 'GitHub', Icon: Github},
  {provider: 'apple', name: 'Apple', Icon: Apple},
  {provider: 'microsoft', name: 'Microsoft', Icon: Monitor},
];

const getStrength = value => {
  if (!value) {
    return {score: 0, label: '', color: 'rgba(255,255,255,0.1)'};
  }
  let score = 0;
  if (value.length >= 8) {
    score += 1;
  }
  if (value.length >= 12) {
    score += 1;
  }
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) {
    score += 1;
  }
  if (/[0-9]/.test(value)) {
    score += 1;
  }
  if (/[^A-Za-z0-9]/.test(value)) {
    score += 1;
  }
  const level = Math.max(1, Math.min(score, 4));
  return [
    null,
    {score: 1, label: 'Weak', color: COLORS.red},
    {score: 2, label: 'Fair', color: '#fb923c'},
    {score: 3, label: 'Good', color: '#facc15'},
    {score: 4, label: 'Strong', color: COLORS.green},
  ][level];
};

const Field = ({
  label,
  icon: Icon,
  secure,
  visible,
  onToggleSecure,
  ...props
}) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputWrap}>
      {Icon ? (
        <Icon size={16} color={COLORS.soft} style={styles.inputIcon} />
      ) : null}
      <TextInput
        {...props}
        placeholderTextColor="rgba(255,255,255,0.22)"
        secureTextEntry={secure && !visible}
        style={[
          styles.input,
          Icon && styles.inputWithIcon,
          secure && styles.inputWithEye,
        ]}
      />
      {secure ? (
        <Pressable onPress={onToggleSecure} style={styles.eyeButton}>
          {visible ? (
            <EyeOff size={17} color={COLORS.soft} />
          ) : (
            <Eye size={17} color={COLORS.soft} />
          )}
        </Pressable>
      ) : null}
    </View>
  </View>
);

const LoginScreen = ({onAuthSuccess}) => {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [oauthSession, setOauthSession] = useState(null);
  const pulse = useRef(new Animated.Value(0)).current;
  const card = useRef(new Animated.Value(0)).current;

  const strength = useMemo(() => getStrength(password), [password]);
  const confirmState = confirm ? password === confirm : null;

  useEffect(() => {
    getPrefs().then(prefs => setRemember(Boolean(prefs.rememberMe)));
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ).start();
    Animated.timing(card, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [card, pulse]);

  const submit = async () => {
    const cleanEmail = email.trim();
    setMessage('');
    if (!cleanEmail) {
      setMessage('Email daalo.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setMessage('Valid email chahiye.');
      return;
    }
    if (!password) {
      setMessage('Password daalo.');
      return;
    }
    if (mode === 'signup') {
      if (!name.trim()) {
        setMessage('Naam daalo.');
        return;
      }
      if (password.length < 8) {
        setMessage('8+ characters chahiye.');
        return;
      }
      if (password !== confirm) {
        setMessage('Passwords match nahi.');
        return;
      }
    }
    setBusy(true);
    try {
      const result =
        mode === 'signup'
          ? await supabaseSignup({
              name: name.trim(),
              email: cleanEmail,
              password,
            })
          : await supabaseLogin({email: cleanEmail, password});
      const user = await saveUser(result.user, result.token);
      const prefs = await getPrefs();
      await savePrefs({...prefs, rememberMe: remember});
      setBusy(false);
      onAuthSuccess(user);
    } catch (error) {
      setBusy(false);
      setMessage(error.message || 'Login failed. Auth settings check karo.');
    }
  };

  const socialLogin = async item => {
    setBusy(true);
    setMessage('');
    try {
      if (!IS_CLOUD_BACKEND_CONFIGURED) {
        throw new Error(
          'Social login ke liye cloud backend URL set karna hoga. Email Login/Sign Up Supabase se direct chalega.',
        );
      }
      const url = await getOAuthStartUrl(item.provider);
      setOauthSession({...item, url});
    } catch (error) {
      setMessage(
        error.message || `${item.name} login failed. Backend check karo.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const handleOAuthMessage = async event => {
    try {
      const payload = JSON.parse(event.nativeEvent.data || '{}');
      if (payload.type === 'oauth-success' && payload.token && payload.user) {
        const user = await saveUser(payload.user, payload.token);
        const prefs = await getPrefs();
        await savePrefs({...prefs, rememberMe: remember});
        setOauthSession(null);
        onAuthSuccess(user);
        return;
      }
      if (payload.type === 'oauth-error') {
        setMessage(payload.message || 'OAuth login failed.');
        setOauthSession(null);
      }
    } catch {
      setMessage('OAuth response read nahi ho paya.');
      setOauthSession(null);
    }
  };

  const logoScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const logoOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.75, 1],
  });

  return (
    <LinearGradient
      colors={['#020305', '#06101f', '#0b1026', '#050507']}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
      style={styles.screen}>
      <View pointerEvents="none" style={styles.loginFrame}>
        <LinearGradient
          colors={['#050507', '#09192a', '#120c2d', '#050507']}
          start={{x: 0.12, y: 0}}
          end={{x: 0.88, y: 1}}
          style={styles.backgroundPlane}
        />
        <LinearGradient
          colors={[
            'rgba(91,231,255,0.55)',
            'rgba(139,91,255,0.28)',
            'rgba(5,5,7,0)',
          ]}
          start={{x: 1, y: 0}}
          end={{x: 0.08, y: 0.95}}
          style={styles.topGlow}
        />
        <LinearGradient
          colors={[
            'rgba(240,242,255,0.96)',
            'rgba(91,231,255,0.68)',
            'rgba(255,211,110,0.28)',
            'rgba(5,5,7,0)',
          ]}
          start={{x: 0, y: 1}}
          end={{x: 1, y: 0}}
          style={styles.bottomBloom}
        />
        <LinearGradient
          colors={[
            'rgba(91,231,255,0.62)',
            'rgba(139,91,255,0.26)',
            'rgba(5,5,7,0)',
          ]}
          start={{x: 0.1, y: 1}}
          end={{x: 0.85, y: 0.05}}
          style={styles.cyanSpotlight}
        />
        <LinearGradient
          colors={[
            'rgba(255,211,110,0.42)',
            'rgba(139,91,255,0.22)',
            'rgba(5,5,7,0)',
          ]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.goldAccent}
        />
        <LinearGradient
          colors={['rgba(5,5,7,0.55)', 'rgba(5,5,7,0.18)', 'rgba(5,5,7,0)']}
          start={{x: 0.1, y: 0}}
          end={{x: 0.96, y: 1}}
          style={styles.diagonalShade}
        />
        <View style={styles.softNoise} />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled">
          <Animated.View
            style={[
              styles.card,
              {
                opacity: card,
                transform: [
                  {
                    scale: card.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.94, 1],
                    }),
                  },
                  {
                    translateY: card.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}>
            <View style={styles.top}>
              <Animated.View
                style={{transform: [{scale: logoScale}], opacity: logoOpacity}}>
                <LinearGradient
                  colors={GRADIENTS.logo}
                  style={[styles.logo, shadow.glowPurple]}
                />
              </Animated.View>
              <View style={styles.pill}>
                <Text style={styles.pillText}>vertex.ai</Text>
              </View>
            </View>
            <GradientText style={styles.title}>vertex.ai</GradientText>
            <Text style={styles.subtitle}>Your all-in-one AI workspace</Text>

            <View style={styles.tabs}>
              {['login', 'signup'].map(item => {
                const active = mode === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setMode(item)}
                    style={styles.tabShell}>
                    {active ? (
                      <LinearGradient
                        colors={GRADIENTS.gold}
                        start={{x: 0, y: 0}}
                        end={{x: 1, y: 1}}
                        style={styles.tabActive}>
                        <Text style={styles.tabActiveText}>
                          {item === 'login' ? 'Login' : 'Sign Up'}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <Text style={styles.tabText}>
                        {item === 'login' ? 'Login' : 'Sign Up'}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {mode === 'signup' ? (
              <Field
                label="Full Name"
                icon={User}
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
              />
            ) : null}
            <Field
              label="Email"
              icon={Mail}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Field
              label="Password"
              icon={Lock}
              value={password}
              onChangeText={setPassword}
              placeholder="********"
              secure
              visible={showPassword}
              onToggleSecure={() => setShowPassword(value => !value)}
            />
            {mode === 'signup' && password ? (
              <View style={styles.strengthRow}>
                <View style={styles.strengthBars}>
                  {[0, 1, 2, 3].map(index => (
                    <View
                      key={index}
                      style={[
                        styles.strengthSeg,
                        index < strength.score && {
                          backgroundColor: strength.color,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthText, {color: strength.color}]}>
                  {strength.label}
                </Text>
              </View>
            ) : null}
            {mode === 'signup' ? (
              <>
                <Field
                  label="Confirm Password"
                  icon={Lock}
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="********"
                  secure
                  visible={showConfirm}
                  onToggleSecure={() => setShowConfirm(value => !value)}
                />
                <View style={styles.matchRow}>
                  {confirmState === true ? (
                    <Check size={13} color={COLORS.green} />
                  ) : null}
                  {confirmState === false ? (
                    <X size={13} color={COLORS.red} />
                  ) : null}
                  <Text
                    style={[
                      styles.matchText,
                      confirmState === true && {color: COLORS.green},
                      confirmState === false && {color: COLORS.red},
                    ]}>
                    {confirm ? (confirmState ? 'Match' : 'No match') : ' '}
                  </Text>
                </View>
              </>
            ) : null}

            <View style={styles.authRow}>
              <View style={styles.remember}>
                <Switch
                  value={remember}
                  onValueChange={setRemember}
                  trackColor={{
                    false: 'rgba(255,255,255,0.12)',
                    true: COLORS.purple,
                  }}
                  thumbColor={remember ? '#fff' : 'rgba(255,255,255,0.35)'}
                />
                <Text style={styles.rememberText}>Remember me</Text>
              </View>
              <Pressable
                onPress={() =>
                  Alert.alert(
                    'Forgot password',
                    'Demo app: login with any valid email and password.',
                  )
                }>
                <Text style={styles.forgot}>Forgot password?</Text>
              </Pressable>
            </View>

            <Pressable disabled={busy} onPress={submit}>
              <LinearGradient
                colors={GRADIENTS.gold}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={[styles.submit, busy && {opacity: 0.7}]}>
                <Text style={styles.submitText}>
                  {busy
                    ? 'Loading...'
                    : mode === 'login'
                    ? 'Login'
                    : 'Create Account'}
                </Text>
              </LinearGradient>
            </Pressable>
            <Text style={[styles.message, message ? styles.error : null]}>
              {message}
            </Text>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
              <View style={styles.dividerLine} />
            </View>
            <View style={styles.socialGrid}>
              {socialProviders.map(item => {
                const Icon = item.Icon;
                return (
                  <Pressable
                    disabled={busy}
                    key={item.provider}
                    onPress={() => socialLogin(item)}
                    style={({pressed}) => [
                      styles.socialButton,
                      pressed && {opacity: 0.74},
                      busy && {opacity: 0.6},
                    ]}>
                    <Icon size={17} color={COLORS.text} />
                    <Text style={styles.socialText}>{item.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </ScrollView>
        <Modal
          animationType="slide"
          transparent
          visible={Boolean(oauthSession)}
          onRequestClose={() => setOauthSession(null)}>
          <View style={styles.oauthOverlay}>
            <View style={styles.oauthPanel}>
              <View style={styles.oauthHeader}>
                <Text style={styles.oauthTitle}>
                  {oauthSession?.name || 'Social'} Login
                </Text>
                <Pressable
                  onPress={() => setOauthSession(null)}
                  style={styles.oauthClose}>
                  <X size={16} color={COLORS.text} />
                </Pressable>
              </View>
              {oauthSession?.url ? (
                <WebView
                  source={{uri: oauthSession.url}}
                  javaScriptEnabled
                  domStorageEnabled
                  startInLoadingState
                  onMessage={handleOAuthMessage}
                  onError={() => {
                    setMessage(
                      'OAuth page load nahi hua. Backend URL check karo.',
                    );
                    setOauthSession(null);
                  }}
                  renderLoading={() => (
                    <View style={styles.oauthLoading}>
                      <ActivityIndicator color={COLORS.gold} />
                      <Text style={styles.oauthLoadingText}>
                        Opening login...
                      </Text>
                    </View>
                  )}
                  style={styles.oauthWebview}
                />
              ) : null}
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
    overflow: 'hidden',
  },
  keyboard: {
    flex: 1,
  },
  scroll: {
    minHeight: '100%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  loginFrame: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 34,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  backgroundPlane: {
    ...StyleSheet.absoluteFillObject,
  },
  topGlow: {
    position: 'absolute',
    top: -110,
    right: -105,
    width: 410,
    height: 410,
    borderRadius: 205,
  },
  bottomBloom: {
    position: 'absolute',
    left: -150,
    right: -110,
    bottom: -120,
    height: 520,
    borderRadius: 280,
  },
  cyanSpotlight: {
    position: 'absolute',
    left: -90,
    right: -30,
    bottom: -70,
    height: 360,
    borderRadius: 220,
  },
  goldAccent: {
    position: 'absolute',
    top: -30,
    left: -65,
    width: 250,
    height: 250,
    borderRadius: 125,
  },
  diagonalShade: {
    position: 'absolute',
    top: 72,
    left: -90,
    right: -40,
    height: 410,
    transform: [{rotate: '-9deg'}],
  },
  softNoise: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.025)',
    backgroundColor: 'rgba(255,255,255,0.012)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: radius.xl,
    padding: 20,
    backgroundColor: 'rgba(13,15,22,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    ...shadow.card,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 13,
  },
  pill: {
    borderWidth: 1,
    borderColor: 'rgba(249,209,122,0.34)',
    backgroundColor: 'rgba(249,209,122,0.08)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: {
    color: '#f5d38a',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: FONT.bold,
  },
  title: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '800',
    fontFamily: FONT.extraBold,
    textTransform: 'lowercase',
  },
  subtitle: {
    color: '#a8afc8',
    fontSize: 12,
    marginBottom: 12,
    fontFamily: FONT.medium,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  tabShell: {
    flex: 1,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    color: '#e7ebff',
    fontWeight: '800',
    fontFamily: FONT.bold,
  },
  tabActiveText: {
    color: '#111',
    fontWeight: '800',
    fontFamily: FONT.extraBold,
  },
  field: {
    marginTop: 11,
  },
  label: {
    fontSize: 12,
    color: '#9fa8c8',
    marginBottom: 5,
    fontWeight: '700',
    fontFamily: FONT.semiBold,
  },
  inputWrap: {
    minHeight: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: COLORS.input,
    justifyContent: 'center',
  },
  input: {
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontFamily: FONT.regular,
  },
  inputWithIcon: {
    paddingLeft: 40,
  },
  inputWithEye: {
    paddingRight: 46,
  },
  inputIcon: {
    position: 'absolute',
    left: 13,
    zIndex: 1,
  },
  eyeButton: {
    position: 'absolute',
    right: 4,
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  strengthBars: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
  },
  strengthSeg: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  strengthText: {
    minWidth: 44,
    textAlign: 'right',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: FONT.bold,
  },
  matchRow: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  matchText: {
    color: COLORS.soft,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONT.semiBold,
  },
  authRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  remember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rememberText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONT.semiBold,
  },
  forgot: {
    color: '#9fd8ff',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONT.semiBold,
  },
  submit: {
    marginTop: 13,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  submitText: {
    color: '#111',
    fontSize: 14,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  message: {
    minHeight: 20,
    marginTop: 8,
    textAlign: 'center',
    color: COLORS.green,
    fontSize: 13,
    fontFamily: FONT.medium,
  },
  error: {
    color: '#ff8a8a',
  },
  dividerRow: {
    marginTop: 2,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  dividerText: {
    color: COLORS.soft,
    fontSize: 9,
    letterSpacing: 1.1,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  socialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  socialButton: {
    width: '48.7%',
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    backgroundColor: 'rgba(255,255,255,0.055)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  socialText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: FONT.bold,
  },
  oauthOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    padding: 14,
    justifyContent: 'center',
  },
  oauthPanel: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.card,
  },
  oauthHeader: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  oauthTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    fontFamily: FONT.extraBold,
  },
  oauthClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  oauthWebview: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  oauthLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
    gap: 10,
  },
  oauthLoadingText: {
    color: COLORS.soft,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONT.semiBold,
  },
});

export default LoginScreen;
