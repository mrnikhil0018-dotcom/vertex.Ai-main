import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
  user: 'vx_user',
  token: 'vx_token',
  chats: 'vx_chats',
  avatar: 'vx_avatar',
  prefs: 'vx_prefs',
};

const readJSON = async (key, fallback) => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJSON = (key, value) =>
  AsyncStorage.setItem(key, JSON.stringify(value));

export const getUser = () => readJSON(STORAGE_KEYS.user, null);

export const saveUser = async (user, token = '') => {
  const finalUser = {
    id: user.id || user._id || '',
    name: user.name || 'User',
    email: user.email || '',
    authProvider: user.authProvider || 'email',
    at: user.at || new Date().toISOString(),
  };
  await writeJSON(STORAGE_KEYS.user, finalUser);
  await AsyncStorage.setItem(
    STORAGE_KEYS.token,
    token || user.token || `vertex-${Date.now()}`,
  );
  return finalUser;
};

export const getToken = () => AsyncStorage.getItem(STORAGE_KEYS.token);

export const clearAuth = async () => {
  await AsyncStorage.multiRemove([STORAGE_KEYS.user, STORAGE_KEYS.token]);
};

export const getPrefs = () =>
  readJSON(STORAGE_KEYS.prefs, {
    voiceOutput: false,
    darkTheme: true,
    rememberMe: true,
    aiModel: 'vertex',
  });

export const savePrefs = prefs => writeJSON(STORAGE_KEYS.prefs, prefs);

export const getChats = () => readJSON(STORAGE_KEYS.chats, []);

export const saveChats = chats => writeJSON(STORAGE_KEYS.chats, chats);

export const upsertChat = async chat => {
  const all = await getChats();
  const next = all.filter(item => item.id !== chat.id);
  next.unshift(chat);
  const clipped = next.slice(0, 25);
  await saveChats(clipped);
  return clipped;
};

export const deleteChat = async chatId => {
  const all = await getChats();
  const next = all.filter(item => item.id !== chatId);
  await saveChats(next);
  return next;
};

export const getAvatar = () => readJSON(STORAGE_KEYS.avatar, null);

export const saveAvatar = avatar => writeJSON(STORAGE_KEYS.avatar, avatar);
