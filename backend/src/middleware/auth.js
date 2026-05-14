const jwt = require('jsonwebtoken');
const {
  findOrCreateSupabaseAuthUser,
  findUserById,
} = require('../services/supabaseDb');

module.exports = async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      return res.status(401).json({message: 'Login required'});
    }
    let user = null;
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      user = await findUserById(payload.id);
    } catch {
      user = await findOrCreateSupabaseAuthUser(token);
    }
    if (!user) {
      return res.status(401).json({message: 'User not found'});
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({message: 'Invalid session'});
  }
};
