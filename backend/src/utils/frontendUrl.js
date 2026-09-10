/**
 * Public frontend origin for email links (password reset, verification).
 * Prefer a non-localhost FRONTEND_URL; otherwise use the request Origin/Referer
 * so production emails never ship localhost links when the env is still local.
 */

const stripTrailingSlash = (url) => String(url || '').trim().replace(/\/+$/, '');

const isLocalHostname = (url) => {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.local');
  } catch {
    return true;
  }
};

const originFromRequest = (req) => {
  if (!req) return '';
  const origin = req.get?.('origin') || req.headers?.origin || '';
  if (origin && !isLocalHostname(origin)) return stripTrailingSlash(origin);

  const referer = req.get?.('referer') || req.headers?.referer || '';
  if (referer) {
    try {
      const parsed = new URL(referer);
      const base = `${parsed.protocol}//${parsed.host}`;
      if (!isLocalHostname(base)) return stripTrailingSlash(base);
    } catch {
      /* ignore invalid referer */
    }
  }

  const cors = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => stripTrailingSlash(s))
    .find((s) => s && !isLocalHostname(s));
  return cors || '';
};

const getFrontendBase = (req) => {
  const envUrl = stripTrailingSlash(process.env.FRONTEND_URL);
  const reqOrigin = originFromRequest(req);
  if (envUrl && !isLocalHostname(envUrl)) return envUrl;
  if (reqOrigin) return reqOrigin;
  return envUrl || 'http://localhost:5173';
};

module.exports = { getFrontendBase, isLocalHostname };
