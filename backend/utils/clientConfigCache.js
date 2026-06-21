import Client from "../models/Client.js";

const PREFIX = "client:config:";
const TTL_SECONDS = 300;

export function clientConfigKey(apiKey) {
  return `${PREFIX}${apiKey}`;
}

export function serializeClientConfig(client) {
  return JSON.stringify({
    name: client.name,
    perMinuteLimit: client.perMinuteLimit,
    perDayLimit: client.perDayLimit,
    enabled: client.enabled,
  });
}

export async function getCachedClientConfig(redis, apiKey) {
  const cached = await redis.get(clientConfigKey(apiKey));
  if (!cached) {
    return null;
  }
  return JSON.parse(cached);
}

export async function cacheClientConfig(redis, client) {
  const config = JSON.parse(serializeClientConfig(client));
  await redis.setEx(clientConfigKey(client.apiKey), TTL_SECONDS, JSON.stringify(config));
  return config;
}

export async function invalidateClientConfig(redis, apiKey) {
  if (!apiKey) {
    return;
  }
  await redis.del(clientConfigKey(apiKey));
}

export async function resolveClientConfig(redis, apiKey) {
  const cached = await getCachedClientConfig(redis, apiKey);
  if (cached) {
    return cached;
  }

  const client = await Client.findOne({ apiKey });
  if (!client) {
    return null;
  }

  return cacheClientConfig(redis, client);
}
