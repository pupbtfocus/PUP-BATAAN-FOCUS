type LogLevel = "info" | "warn" | "error";

function write(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
) {
  const payload = {
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
  };

  // Console output is used as transport in early project stages.
  console[level](JSON.stringify(payload));
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) =>
    write("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) =>
    write("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) =>
    write("error", message, context),
};
