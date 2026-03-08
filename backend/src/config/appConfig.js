const defaultOrigins = [
  process.env.FRONTEND_ORIGIN || ''
];

const normalizeOrigins = (origins) =>
  origins
    .filter(Boolean)
    .flatMap((entry) => entry.split(','))
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowedOrigins = Array.from(new Set(normalizeOrigins(defaultOrigins)));

const appConfig = {
  port: Number(process.env.PORT) || 5000,
  allowedOrigins: allowedOrigins.length > 0 ? allowedOrigins : ['*'],
};

module.exports = { appConfig };
