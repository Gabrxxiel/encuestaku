const crypto = require('crypto');

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header
      .split(';')
      .map(c => c.trim())
      .filter(Boolean)
      .map(c => {
        const idx = c.indexOf('=');
        return [c.slice(0, idx), decodeURIComponent(c.slice(idx + 1))];
      })
  );
}

function isValidSession(req) {
  const token = parseCookies(req).admin_session;
  if (!token) return false;

  const [expires, sig] = token.split('.');
  if (!expires || !sig) return false;
  if (Date.now() > Number(expires)) return false;

  const expected = sign(expires, process.env.SESSION_SECRET);
  const sigBuf = Buffer.from(sig, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length) return false;

  return crypto.timingSafeEqual(sigBuf, expBuf);
}

module.exports = { sign, parseCookies, isValidSession };
