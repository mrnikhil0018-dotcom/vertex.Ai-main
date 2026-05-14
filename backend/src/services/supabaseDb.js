const {createClient} = require('@supabase/supabase-js');

let client;

const required = value => String(value || '').trim();

const getSupabase = () => {
  if (!client) {
    const url = required(process.env.SUPABASE_URL);
    const key = required(
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
    );
    if (!url || !key) {
      throw new Error('Supabase URL/service role key missing in backend .env');
    }
    client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return client;
};

const mapUser = row =>
  row
    ? {
        id: row.id,
        name: row.name,
        email: row.email,
        passwordHash: row.password_hash || '',
        authProvider: row.auth_provider || 'email',
        providerId: row.provider_id || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;

const mapChat = row => ({
  id: row.id,
  preview: row.preview || 'Chat',
  date: new Date(row.updated_at || row.created_at || Date.now()).toLocaleDateString(),
  messages: Array.isArray(row.messages) ? row.messages : [],
});

const findUserById = async id => {
  const {data, error} = await getSupabase()
    .from('app_users')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return mapUser(data);
};

const findUserByEmail = async email => {
  const {data, error} = await getSupabase()
    .from('app_users')
    .select('*')
    .eq('email', String(email || '').toLowerCase().trim())
    .maybeSingle();
  if (error) {
    throw error;
  }
  return mapUser(data);
};

const createUser = async ({
  name,
  email,
  passwordHash = '',
  authProvider = 'email',
  providerId = '',
}) => {
  const {data, error} = await getSupabase()
    .from('app_users')
    .insert({
      name,
      email: String(email || '').toLowerCase().trim(),
      password_hash: passwordHash,
      auth_provider: authProvider,
      provider_id: providerId,
    })
    .select('*')
    .single();
  if (error) {
    throw error;
  }
  return mapUser(data);
};

const updateUserAuth = async (id, values) => {
  const {data, error} = await getSupabase()
    .from('app_users')
    .update({
      name: values.name,
      auth_provider: values.authProvider,
      provider_id: values.providerId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    throw error;
  }
  return mapUser(data);
};

const findUserByProvider = async ({provider, providerId}) => {
  if (!providerId) {
    return null;
  }
  const {data, error} = await getSupabase()
    .from('app_users')
    .select('*')
    .eq('auth_provider', provider)
    .eq('provider_id', providerId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return mapUser(data);
};

const getUserFromSupabaseToken = async token => {
  const {data, error} = await getSupabase().auth.getUser(token);
  if (error) {
    throw error;
  }
  return data.user || null;
};

const upsertSocialUser = async ({provider, providerId = '', email, name}) => {
  const cleanProvider = String(provider || '').toLowerCase().trim();
  const cleanProviderId = String(providerId || '').trim();
  const cleanEmail = String(email || `${cleanProvider}-${Date.now()}@vertex.social`)
    .toLowerCase()
    .trim();
  const cleanName = String(name || `${cleanProvider} User`).trim();

  const existingByProvider = await findUserByProvider({
    provider: cleanProvider,
    providerId: cleanProviderId,
  });
  const existing = existingByProvider || (await findUserByEmail(cleanEmail));
  if (existing) {
    return updateUserAuth(existing.id, {
      name: existing.name || cleanName,
      authProvider: cleanProvider,
      providerId: cleanProviderId || existing.providerId || '',
    });
  }

  return createUser({
    name: cleanName,
    email: cleanEmail,
    authProvider: cleanProvider,
    providerId: cleanProviderId,
  });
};

const findOrCreateSupabaseAuthUser = async token => {
  const authUser = await getUserFromSupabaseToken(token);
  if (!authUser?.id || !authUser?.email) {
    return null;
  }
  const metadata = authUser.user_metadata || {};
  return upsertSocialUser({
    provider: 'supabase',
    providerId: authUser.id,
    email: authUser.email,
    name:
      metadata.full_name ||
      metadata.name ||
      authUser.email.split('@')[0] ||
      'User',
  });
};

const listChats = async userId => {
  const {data, error} = await getSupabase()
    .from('chats')
    .select('id, preview, messages, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', {ascending: false})
    .limit(25);
  if (error) {
    throw error;
  }
  return (data || []).map(mapChat);
};

const createChat = async ({userId, preview, messages}) => {
  const {data, error} = await getSupabase()
    .from('chats')
    .insert({
      user_id: userId,
      preview: preview || 'Chat',
      messages: Array.isArray(messages) ? messages : [],
    })
    .select('id, preview, messages, created_at, updated_at')
    .single();
  if (error) {
    throw error;
  }
  return mapChat(data);
};

const healthCheck = async () => {
  const {error} = await getSupabase()
    .from('app_users')
    .select('id', {count: 'exact', head: true});
  if (error) {
    throw error;
  }
  return true;
};

module.exports = {
  createChat,
  createUser,
  findUserByEmail,
  findUserById,
  findOrCreateSupabaseAuthUser,
  healthCheck,
  listChats,
  upsertSocialUser,
};
