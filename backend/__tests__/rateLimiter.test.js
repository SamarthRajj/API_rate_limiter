import { jest } from "@jest/globals";
import rateLimiter from "../middlewares/rateLimiter.js";
import { cacheClientConfig } from "../utils/clientConfigCache.js";
import Client from "../models/Client.js";
import {
  createMockIo,
  createMockRedis,
  createMockReq,
  createMockRes,
} from "./helpers/mockRedis.js";

const clientConfig = {
  name: "LimiterTest",
  apiKey: "limit-key",
  perMinuteLimit: 2,
  perDayLimit: 10,
  enabled: true,
};

const boundaryConfig = {
  name: "BoundaryTest",
  apiKey: "boundary-key",
  perMinuteLimit: 10,
  perDayLimit: 100,
  enabled: true,
};

describe("rateLimiter", () => {
  let redis;
  let app;
  let middleware;
  let next;

  beforeEach(async () => {
    redis = createMockRedis();
    app = { get: () => createMockIo() };
    middleware = rateLimiter(redis);
    next = jest.fn();
    await cacheClientConfig(redis, clientConfig);
  });

  test("rejects missing API key", async () => {
    const req = createMockReq(app);
    const res = createMockRes();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("API key required");
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects invalid API key", async () => {
    const findOneSpy = jest.spyOn(Client, "findOne").mockResolvedValue(null);
    const req = createMockReq(app, "unknown-key");
    const res = createMockRes();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Invalid API key");
    findOneSpy.mockRestore();
  });

  test("rejects disabled API key", async () => {
    await cacheClientConfig(redis, { ...clientConfig, apiKey: "disabled-key", enabled: false });
    const req = createMockReq(app, "disabled-key");
    const res = createMockRes();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe("API key is disabled");
  });

  test("allows requests under limit", async () => {
    const req = createMockReq(app, "limit-key");
    const res = createMockRes();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test("blocks when minute limit exceeded", async () => {
    const minuteWindow = Math.floor(Date.now() / 60000);
    await redis.set(`count:limit-key:m:${minuteWindow}`, "2");

    const req = createMockReq(app, "limit-key");
    const res = createMockRes();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(429);
    expect(res.body.message).toBe("Rate limit exceeded");
    expect(next).not.toHaveBeenCalled();
  });

  test("blocks when day limit exceeded", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await redis.set(`count:limit-key:d:${today}`, "10");

    const req = createMockReq(app, "limit-key");
    const res = createMockRes();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(429);
    expect(next).not.toHaveBeenCalled();
  });

  test("does not increment counters when blocked", async () => {
    const minuteWindow = Math.floor(Date.now() / 60000);
    const today = new Date().toISOString().slice(0, 10);
    await redis.set(`count:limit-key:m:${minuteWindow}`, "2");
    await redis.set(`count:limit-key:d:${today}`, "5");

    const req = createMockReq(app, "limit-key");
    const res = createMockRes();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(429);
    expect(await redis.get(`count:limit-key:m:${minuteWindow}`)).toBe("2");
    expect(await redis.get(`count:limit-key:d:${today}`)).toBe("5");
  });

  test("allows request at exact minute boundary", async () => {
    await cacheClientConfig(redis, boundaryConfig);
    const minuteWindow = Math.floor(Date.now() / 60000);
    await redis.set(`count:boundary-key:m:${minuteWindow}`, "9");

    const req = createMockReq(app, "boundary-key");
    const res = createMockRes();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(await redis.get(`count:boundary-key:m:${minuteWindow}`)).toBe("10");
  });

  test("blocks request one over minute boundary", async () => {
    await cacheClientConfig(redis, boundaryConfig);
    const minuteWindow = Math.floor(Date.now() / 60000);
    await redis.set(`count:boundary-key:m:${minuteWindow}`, "10");

    const req = createMockReq(app, "boundary-key");
    const res = createMockRes();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(429);
    expect(await redis.get(`count:boundary-key:m:${minuteWindow}`)).toBe("10");
  });
});
