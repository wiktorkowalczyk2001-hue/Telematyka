const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const bcrypt = require('bcryptjs');
const path = require('path');

const API = 'http://192.168.0.31:3001';
const LM  = 'http://192.168.0.31:1234';

const app = express();

// ── Auth endpoint (bcrypt verify — not exposed through raw PostgREST) ─────────
// express.json() only on this route — global body parsing consumes the stream
// and breaks proxy forwarding for /api and /lm POST requests
app.post('/auth/login', express.json(), async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Podaj email i hasło.' });

  try {
    const r = await fetch(`${API}/users?email=eq.${encodeURIComponent(email)}`);
    if (!r.ok) return res.status(502).json({ error: 'Błąd bazy danych.' });
    const users = await r.json();
    if (!users.length) return res.status(401).json({ error: 'Nieprawidłowy email lub hasło.' });

    const user = users[0];
    if (user.status === 'rejected') return res.status(403).json({ error: 'Konto odrzucone. Skontaktuj się z administratorem.' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Nieprawidłowy email lub hasło.' });

    // Return user without password_hash
    const { password_hash, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
  } catch (e) {
    console.error('[auth/login]', e);
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

// ── Proxies ───────────────────────────────────────────────────────────────────
app.use('/api', createProxyMiddleware({ target: API, changeOrigin: true, pathRewrite: { '^/api': '' } }));
app.use('/lm',  createProxyMiddleware({ target: LM,  changeOrigin: true, pathRewrite: { '^/lm': '' } }));

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'dist')));
app.get('/{*path}', (_, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(4000, () => console.log('Server: http://localhost:4000'));
