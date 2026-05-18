const bcrypt = require('bcryptjs');
const axios = require('axios');
const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const {
  createUser,
  findUserByEmail,
  findOrCreateSupabaseAuthUser,
  upsertSocialUser,
} = require('../services/supabaseDb');

const router = express.Router();

const signToken = user =>
  jwt.sign({id: user.id}, process.env.JWT_SECRET, {expiresIn: '30d'});

const publicUser = user => ({
  id: user.id,
  name: user.name,
  email: user.email,
  authProvider: user.authProvider || 'email',
});

const SOCIAL_PROVIDERS = ['google', 'github', 'apple', 'microsoft'];

const providerName = provider =>
  provider.charAt(0).toUpperCase() + provider.slice(1);

const safeJson = value => JSON.stringify(value).replace(/</g, '\\u003c');

const oauthHtml = payload => `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      body{margin:0;background:#050507;color:#f0f2ff;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh;text-align:center;padding:24px}
      .box{max-width:420px;border:1px solid rgba(255,255,255,.12);background:#0d0f16;border-radius:18px;padding:24px}
      .brand{font-size:28px;font-weight:900;background:linear-gradient(90deg,#5be7ff,#8b5bff,#ffd36e);-webkit-background-clip:text;color:transparent}
      .text{color:#8a93b8;line-height:1.5}
    </style>
  </head>
  <body>
    <div class="box">
      <div class="brand">vertex.ai</div>
      <p class="text">${
        payload.type === 'oauth-success'
          ? 'Login complete. App me wapas ja rahe hain.'
          : payload.message || 'OAuth failed.'
      }</p>
    </div>
    <script>
      const payload = ${safeJson(payload)};
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    </script>
  </body>
</html>`;

const oauthError = (res, message) =>
  res.status(200).send(oauthHtml({type: 'oauth-error', message}));

const publicBaseUrl = req =>
  (process.env.PUBLIC_BACKEND_URL || `${req.protocol}://${req.get('host')}`)
    .replace(/\/+$/, '');

const oauthRedirectUri = (req, provider) =>
  `${publicBaseUrl(req)}/api/auth/oauth/${provider}/callback`;

const oauthState = provider =>
  jwt.sign(
    {
      provider,
      nonce: crypto.randomBytes(12).toString('hex'),
    },
    process.env.JWT_SECRET,
    {expiresIn: '10m'},
  );

const verifyOAuthState = (provider, state) => {
  const payload = jwt.verify(state, process.env.JWT_SECRET);
  if (payload.provider !== provider) {
    throw new Error('OAuth state invalid hai');
  }
};

const providerConfig = provider => {
  const configs = {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID,
      teamId: process.env.APPLE_TEAM_ID,
      keyId: process.env.APPLE_KEY_ID,
      privateKey: process.env.APPLE_PRIVATE_KEY,
    },
  };
  return configs[provider] || {};
};

const hasOAuthConfig = provider => {
  const config = providerConfig(provider);
  if (provider === 'apple') {
    return Boolean(
      config.clientId &&
        config.teamId &&
        config.keyId &&
        config.privateKey,
    );
  }
  return Boolean(config.clientId && config.clientSecret);
};

const postForm = (url, params, headers = {}) =>
  axios.post(url, new URLSearchParams(params).toString(), {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      ...headers,
    },
  });

const upsertOAuthUser = async ({provider, providerId, email, name}) => {
  const cleanProvider = provider.toLowerCase();
  const cleanProviderId = String(providerId || '').trim();
  const cleanEmail = String(
    email || `${cleanProvider}-${cleanProviderId || Date.now()}@vertex.social`,
  )
    .toLowerCase()
    .trim();
  const cleanName = String(name || `${providerName(cleanProvider)} User`).trim();

  return upsertSocialUser({
    provider: cleanProvider,
    providerId: cleanProviderId,
    email: cleanEmail,
    name: cleanName,
  });
};

const exchangeGoogle = async (req, code) => {
  const config = providerConfig('google');
  const token = await postForm('https://oauth2.googleapis.com/token', {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: oauthRedirectUri(req, 'google'),
  });
  const profile = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {Authorization: `Bearer ${token.data.access_token}`},
  });
  return {
    provider: 'google',
    providerId: profile.data.sub,
    email: profile.data.email,
    name: profile.data.name,
  };
};

const exchangeGithub = async (req, code) => {
  const config = providerConfig('github');
  const token = await postForm('https://github.com/login/oauth/access_token', {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: oauthRedirectUri(req, 'github'),
  });
  const headers = {Authorization: `Bearer ${token.data.access_token}`};
  const profile = await axios.get('https://api.github.com/user', {headers});
  const emails = await axios.get('https://api.github.com/user/emails', {headers});
  const primaryEmail =
    emails.data.find(item => item.primary && item.verified)?.email ||
    emails.data.find(item => item.verified)?.email ||
    profile.data.email;
  return {
    provider: 'github',
    providerId: profile.data.id,
    email: primaryEmail,
    name: profile.data.name || profile.data.login,
  };
};

const exchangeMicrosoft = async (req, code) => {
  const config = providerConfig('microsoft');
  const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  const token = await postForm(tokenUrl, {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: oauthRedirectUri(req, 'microsoft'),
  });
  const profile = await axios.get('https://graph.microsoft.com/v1.0/me', {
    headers: {Authorization: `Bearer ${token.data.access_token}`},
  });
  return {
    provider: 'microsoft',
    providerId: profile.data.id,
    email: profile.data.mail || profile.data.userPrincipalName,
    name: profile.data.displayName,
  };
};

const appleClientSecret = () => {
  const config = providerConfig('apple');
  const privateKey = config.privateKey.replace(/\\n/g, '\n');
  return jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    audience: 'https://appleid.apple.com',
    expiresIn: '180d',
    issuer: config.teamId,
    keyid: config.keyId,
    subject: config.clientId,
  });
};

const exchangeApple = async (req, code) => {
  const config = providerConfig('apple');
  const token = await postForm('https://appleid.apple.com/auth/token', {
    client_id: config.clientId,
    client_secret: appleClientSecret(),
    code,
    grant_type: 'authorization_code',
    redirect_uri: oauthRedirectUri(req, 'apple'),
  });
  const decoded = jwt.decode(token.data.id_token) || {};
  const appleUser = req.body.user ? JSON.parse(req.body.user) : {};
  const name = appleUser.name
    ? `${appleUser.name.firstName || ''} ${appleUser.name.lastName || ''}`.trim()
    : '';
  return {
    provider: 'apple',
    providerId: decoded.sub,
    email: decoded.email,
    name: name || 'Apple User',
  };
};

const exchangeOAuthProfile = (provider, req, code) => {
  if (provider === 'google') {
    return exchangeGoogle(req, code);
  }
  if (provider === 'github') {
    return exchangeGithub(req, code);
  }
  if (provider === 'microsoft') {
    return exchangeMicrosoft(req, code);
  }
  if (provider === 'apple') {
    return exchangeApple(req, code);
  }
  throw new Error('Invalid provider');
};

router.post('/signup', async (req, res) => {
  try {
    const {name, email, password} = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({message: 'Name, email aur password required hai'});
    }
    if (password.length < 8) {
      return res.status(400).json({message: 'Password 8+ characters ka hona chahiye'});
    }
    const cleanEmail = email.toLowerCase().trim();
    const exists = await findUserByEmail(cleanEmail);
    if (exists) {
      return res.status(409).json({message: 'Email already registered hai'});
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser({
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
    });
    res.status(201).json({token: signToken(user), user: publicUser(user)});
  } catch (error) {
    res.status(500).json({message: error.message});
  }
});

router.post('/login', async (req, res) => {
  try {
    const {email, password} = req.body;
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({message: 'Invalid email ya password'});
    }
    if (!user.passwordHash) {
      return res.status(401).json({message: 'Ye account social login se bana hai'});
    }
    const ok = await bcrypt.compare(password || '', user.passwordHash);
    if (!ok) {
      return res.status(401).json({message: 'Invalid email ya password'});
    }
    res.json({token: signToken(user), user: publicUser(user)});
  } catch (error) {
    res.status(500).json({message: error.message});
  }
});

router.post('/social', async (req, res) => {
  try {
    const {provider, name, email, providerId} = req.body;
    const cleanProvider = String(provider || '').toLowerCase().trim();
    if (!SOCIAL_PROVIDERS.includes(cleanProvider)) {
      return res.status(400).json({message: 'Invalid social provider'});
    }

    const fallbackEmail = `${cleanProvider}-${String(providerId || Date.now())
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase()}@vertex.social`;
    const cleanEmail = String(email || fallbackEmail).toLowerCase().trim();
    const cleanName = String(name || `${providerName(cleanProvider)} User`).trim();

    const user = await upsertSocialUser({
      provider: cleanProvider,
      providerId: String(providerId || ''),
      email: cleanEmail,
      name: cleanName,
    });

    res.json({token: signToken(user), user: publicUser(user)});
  } catch (error) {
    res.status(500).json({message: error.message});
  }
});

router.post('/supabase/session', async (req, res) => {
  try {
    const header = req.headers.authorization || '';
    const headerToken = header.startsWith('Bearer ') ? header.slice(7) : '';
    const accessToken = req.body.accessToken || headerToken;
    if (!accessToken) {
      return res.status(400).json({message: 'Supabase access token required'});
    }

    const user = await findOrCreateSupabaseAuthUser(accessToken);
    if (!user) {
      return res.status(401).json({message: 'Invalid Supabase session'});
    }

    res.json({token: signToken(user), user: publicUser(user)});
  } catch (error) {
    res.status(401).json({
      message:
        error.message?.includes('invalid')
          ? 'Invalid Supabase session'
          : error.message || 'Supabase session exchange failed',
    });
  }
});

router.get('/oauth/:provider', (req, res) => {
  try {
    const provider = String(req.params.provider || '').toLowerCase();
    if (!SOCIAL_PROVIDERS.includes(provider)) {
      return oauthError(res, 'Invalid social provider');
    }
    if (!hasOAuthConfig(provider)) {
      return oauthError(
        res,
        `${providerName(provider)} OAuth keys backend .env me missing hain.`,
      );
    }

    const config = providerConfig(provider);
    const redirectUri = oauthRedirectUri(req, provider);
    const state = oauthState(provider);

    if (provider === 'google') {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        prompt: 'select_account',
        state,
      });
      return res.redirect(
        `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      );
    }

    if (provider === 'github') {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        scope: 'read:user user:email',
        state,
      });
      return res.redirect(
        `https://github.com/login/oauth/authorize?${params.toString()}`,
      );
    }

    if (provider === 'microsoft') {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        response_mode: 'query',
        scope: 'openid profile email User.Read',
        prompt: 'select_account',
        state,
      });
      return res.redirect(
        `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize?${params.toString()}`,
      );
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      response_mode: 'form_post',
      scope: 'name email',
      state,
    });
    return res.redirect(
      `https://appleid.apple.com/auth/authorize?${params.toString()}`,
    );
  } catch (error) {
    return oauthError(res, error.message);
  }
});

const finishOAuth = async (req, res) => {
  try {
    const provider = String(req.params.provider || '').toLowerCase();
    const {code, state, error, error_description: errorDescription} = {
      ...req.query,
      ...req.body,
    };
    if (error) {
      return oauthError(res, errorDescription || String(error));
    }
    if (!code || !state) {
      return oauthError(res, 'OAuth code/state missing hai');
    }
    verifyOAuthState(provider, state);
    const profile = await exchangeOAuthProfile(provider, req, code);
    const user = await upsertOAuthUser(profile);
    return res.send(
      oauthHtml({
        type: 'oauth-success',
        token: signToken(user),
        user: publicUser(user),
      }),
    );
  } catch (error) {
    return oauthError(res, error.message || 'OAuth login failed');
  }
};

router.get('/oauth/:provider/callback', finishOAuth);
router.post('/oauth/:provider/callback', finishOAuth);

router.get('/me', auth, (req, res) => {
  res.json({user: publicUser(req.user)});
});

module.exports = router;
