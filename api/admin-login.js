const { sign } = require('./_auth');

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  // Vercel's Node runtime already parses the body into req.body for
  // application/json requests — reading the raw stream here would
  // race against (and lose to) that, leaving password always undefined.
  let parsedBody = req.body;
  if (typeof parsedBody === 'string') {
    try { parsedBody = JSON.parse(parsedBody || '{}'); } catch { parsedBody = {}; }
  }
  const password = parsedBody && parsedBody.password;

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Contraseña incorrecta',
      debug: {
        receivedPassword: password || null,
        receivedBodyType: typeof req.body,
        envVarIsSet: Boolean(process.env.ADMIN_PASSWORD),
        envVarLength: (process.env.ADMIN_PASSWORD || '').length,
      },
    }));
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
};
