import {SUPABASE_ANON_KEY, SUPABASE_URL} from '../supabaseConfig';

const hasSupabaseConfig = () =>
  Boolean(
    String(SUPABASE_URL || '').trim() && String(SUPABASE_ANON_KEY || '').trim(),
  );

const authUrl = path =>
  `${String(SUPABASE_URL).replace(/\/+$/, '')}/auth/v1${path}`;

const timeoutFetch = (url, options = {}, timeout = 18000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(url, {...options, signal: controller.signal}).finally(() =>
    clearTimeout(timer),
  );
};

const authRequest = async (path, body) => {
  if (!hasSupabaseConfig()) {
    throw new Error(
      'Supabase anon key app me missing hai. src/supabaseConfig.js check karo.',
    );
  }
  let response;
  try {
    response = await timeoutFetch(authUrl(path), {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(
      error.name === 'AbortError'
        ? 'Supabase Auth timeout hua. Internet check karke dobara try karo.'
        : 'Supabase Auth connect nahi hua. Internet/VPN/DNS check karo; email login backend par depend nahi karta.',
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data.error_description ||
        data.msg ||
        data.message ||
        `Supabase Auth failed (${response.status})`,
    );
  }
  return data;
};

const mapAuthResult = data => {
  const session = data.session || data;
  const user = data.user || session.user;
  const token = session.access_token;

  if (!user) {
    throw new Error('Supabase user response empty raha.');
  }
  if (!token) {
    throw new Error(
      'Account ban gaya, par email confirmation required hai. Supabase Auth settings me email confirmation off karo ya email verify karo.',
    );
  }

  const metadata = user.user_metadata || {};
  return {
    token,
    user: {
      id: user.id,
      name:
        metadata.full_name ||
        metadata.name ||
        user.email?.split('@')[0] ||
        'User',
      email: user.email || '',
      authProvider: 'supabase',
    },
  };
};

export const supabaseSignup = ({name, email, password}) =>
  authRequest('/signup', {
    email,
    password,
    data: {
      name,
      full_name: name,
    },
  }).then(mapAuthResult);

export const supabaseLogin = ({email, password}) =>
  authRequest('/token?grant_type=password', {
    email,
    password,
  }).then(mapAuthResult);
