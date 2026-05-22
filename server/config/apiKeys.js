function readRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

module.exports = {
  GOOGLE_API_KEY: readRequiredEnv("GOOGLE_API_KEY"),
  GOOGLE_ROUTE_API_KEY: readRequiredEnv("GOOGLE_ROUTE_API_KEY"),
  DEEPSEEK_API_KEY: readRequiredEnv("DEEPSEEK_API_KEY"),
  SERP_API_KEY: readRequiredEnv("SERP_API_KEY"),
};
