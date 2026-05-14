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

app.get('/api/health', (req, res) => {
  res.json({ok: true, app: 'Vertex AI Backend', database: 'supabase'});
});
app.use('/api/auth', authRoutes);
app.use('/api', chatRoutes);

const start = async () => {
  try {
    await healthCheck();
    console.log('Supabase connected');
    app.listen(port, '0.0.0.0', () => {
      console.log(`Vertex AI backend running on http://0.0.0.0:${port}`);
    });
  } catch (error) {
    console.error('Supabase connection failed:', error.message);
    console.error(
      'Run backend/supabase/schema.sql in Supabase SQL Editor and set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.',
    );
    process.exit(1);
  }
};

start();
