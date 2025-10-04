const DEFAULT_PORT = 4000;

export function loadConfig(env = process.env) {
  const port = Number.parseInt(env.DCC_API_PORT ?? `${DEFAULT_PORT}`, 10);
  return {
    port: Number.isNaN(port) ? DEFAULT_PORT : port,
    corsOrigin: env.DCC_API_CORS_ORIGIN ?? '*',
    logLevel: env.DCC_LOG_LEVEL ?? 'info',
    autoStartTelemetry: env.DCC_API_AUTOSTART_TELEMETRY
      ? env.DCC_API_AUTOSTART_TELEMETRY.toLowerCase() !== 'false'
      : false
  };
}
