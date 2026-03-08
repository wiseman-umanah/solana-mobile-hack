const { appConfig } = require('../config/appConfig');

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (appConfig.allowedOrigins.includes('*')) return true;
  return appConfig.allowedOrigins.some((allowed) => allowed === origin);
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', appConfig.allowedOrigins[0] || '*');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept',
  );
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function handlePreflight(req, res) {
  if (req.method === 'OPTIONS') {
    applyCors(req, res);
    res.writeHead(204);
    res.end();
    return true;
  }
  return false;
}

module.exports = {
  applyCors,
  handlePreflight,
  isOriginAllowed,
};
