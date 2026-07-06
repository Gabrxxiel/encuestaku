const { sign } = require('./_auth');

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    let password = null;
    try { password = JSON.parse(body || '{}').password; } catch { /* ignore */ }

    if (!password || password !== process.env.ADMIN_PASSWORD) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Contraseña incorrecta' }));
      return;
    }

    const expires = Date.now() + SESSION_TTL_MS;
    const token = `${expires}.${sign(String(expires), process.env.SESSION_SECRET)}`;

    res.setHeader(
      'Set-Cookie',
      `admin_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`
    );
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true }));
  });
};
