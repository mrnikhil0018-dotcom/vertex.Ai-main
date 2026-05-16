require('dotenv').config();

const cors = require('cors');
const express = require('express');
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const {healthCheck} = require('./services/supabaseDb');

const app = express();
const port = process.env.PORT || 5000;

app.set('trust proxy', true);
app.use(cors());
app.use(express.json({limit: '1mb'}));
app.use(express.urlencoded({extended: true, limit: '1mb'}));

app.get('/', (req, res) => {
  res.json({ok: true, app: 'Vertex AI Backend', status: 'running'});
});

app.get('/api/health', async (req, res) => {
  try {
    await healthCheck();
    res.json({ok: true, app: 'Vertex AI Backend', database: 'supabase'});
  } catch (error) {
    res.status(200).json({
      ok: true,
      app: 'Vertex AI Backend',
      database: 'not_ready',
      warning: error.message,
    });
  }
});
app.use('/api/auth', authRoutes);
app.use('/api', chatRoutes);

const start = async () => {
  try {
    await healthCheck();
    console.log('Supabase connected');
  } catch (error) {
    console.warn('Supabase health check skipped:', error.message);
    console.warn(
      'Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in Cloud Run env vars before using auth.',
    );
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Vertex AI backend running on http://0.0.0.0:${port}`);
  });
};

start();
