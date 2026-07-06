import { jest } from "@jest/globals";
import Client from "../models/Client.js";
import {
  cacheClientConfig,
  clientConfigKey,
  getCachedClientConfig,
  invalidateClientConfig,
  resolveClientConfig,
  serializeClientConfig,
} from "../utils/clientConfigCache.js";
import { createMockRedis } from "./helpers/mockRedis.js";

const sampleClient = {
  name: "TestClient",
  apiKey: "test-api-key",
  perMinuteLimit: 10,
  perDayLimit: 100,
  enabled: true,
};

describe("clientConfigCache", () => {
  let redis;

  beforeEach(() => {
    redis = createMockRedis();
  });

  test("serializeClientConfig stores expected fields", () => {
    const serialized = JSON.parse(serializeClientConfig(sampleClient));
    expect(serialized).toEqual({
      name: "TestClient",
      perMinuteLimit: 10,
      perDayLimit: 100,
      enabled: true,
    });
  });

  test("cacheClientConfig writes to Redis with TTL key", async () => {
    await cacheClientConfig(redis, sampleClient);
    const cached = await redis.get(clientConfigKey(sampleClient.apiKey));
    expect(JSON.parse(cached)).toMatchObject({
      name: "TestClient",
      perMinuteLimit: 10,
    });
  });

  test("getCachedClientConfig returns null on miss", async () => {
    const result = await getCachedClientConfig(redis, "missing-key");
    expect(result).toBeNull();
  });

  test("invalidateClientConfig removes cached entry", async () => {
    await cacheClientConfig(redis, sampleClient);
    await invalidateClientConfig(redis, sampleClient.apiKey);
    const result = await getCachedClientConfig(redis, sampleClient.apiKey);
    expect(result).toBeNull();
  });

  test("resolveClientConfig returns cached config when present", async () => {
    await cacheClientConfig(redis, sampleClient);
    const config = await resolveClientConfig(redis, sampleClient.apiKey);
    expect(config).toMatchObject({
      name: "TestClient",
      perMinuteLimit: 10,
      enabled: true,
    });
  });

  test("clientConfigKey uses stable prefix format", () => {
    expect(clientConfigKey("abc123")).toBe("client:config:abc123");
  });

  test("resolveClientConfig loads from MongoDB on cache miss and caches result", async () => {
    const findOneSpy = jest.spyOn(Client, "findOne").mockResolvedValue(sampleClient);

    const config = await resolveClientConfig(redis, sampleClient.apiKey);

    expect(findOneSpy).toHaveBeenCalledWith({ apiKey: sampleClient.apiKey });
    expect(config).toMatchObject({ name: "TestClient", perMinuteLimit: 10 });
    expect(await getCachedClientConfig(redis, sampleClient.apiKey)).toMatchObject({
      name: "TestClient",
    });

    findOneSpy.mockRestore();
  });
});
