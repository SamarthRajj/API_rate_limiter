import { jest } from "@jest/globals";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { createMockRedis } from "./helpers/mockRedis.js";

const mockRedis = createMockRedis();

await jest.unstable_mockModule("../utils/redisClient.js", () => ({
  default: mockRedis,
}));

const { createApp } = await import("../app.js");
const Client = (await import("../models/Client.js")).default;
const Admin = (await import("../models/Admin.js")).default;

let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  ({ app } = createApp({ redisClient: mockRedis }));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  mockRedis.store.clear();
  await Client.deleteMany({});
  await Admin.deleteMany({});
});

async function createAdminToken() {
  await request(app)
    .post("/api/auth/register")
    .send({ username: "testadmin", password: "testpass123" })
    .expect(201);

  const loginResponse = await request(app)
    .post("/api/auth/login")
    .send({ username: "testadmin", password: "testpass123" })
    .expect(200);

  return loginResponse.body.data.token;
}

describe("API integration", () => {
  test("creates a client and serves protected data", async () => {
    const createResponse = await request(app)
      .post("/api/clients")
      .send({
        name: "IntegrationClient",
        perMinuteLimit: 5,
        perDayLimit: 100,
      })
      .expect(201);

    const apiKey = createResponse.body.apiKey;

    const dataResponse = await request(app)
      .get("/api/data")
      .set("x-api-key", apiKey)
      .expect(200);

    expect(dataResponse.body.success).toBe(true);
  });

  test("returns 401 without API key", async () => {
    await request(app).get("/api/data").expect(401);
  });

  test("enforces rate limits", async () => {
    const createResponse = await request(app)
      .post("/api/clients")
      .send({
        name: "LimitedClient",
        perMinuteLimit: 1,
        perDayLimit: 100,
      })
      .expect(201);

    const apiKey = createResponse.body.apiKey;

    await request(app).get("/api/data").set("x-api-key", apiKey).expect(200);
    await request(app).get("/api/data").set("x-api-key", apiKey).expect(429);
  });

  test("invalidates client config cache after update", async () => {
    const createResponse = await request(app)
      .post("/api/clients")
      .send({
        name: "CacheClient",
        perMinuteLimit: 1,
        perDayLimit: 100,
      })
      .expect(201);

    const { apiKey, _id: id } = createResponse.body;

    await request(app).get("/api/data").set("x-api-key", apiKey).expect(200);
    await request(app).get("/api/data").set("x-api-key", apiKey).expect(429);

    const token = await createAdminToken();

    await request(app)
      .put(`/api/clients/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ perMinuteLimit: 10 })
      .expect(200);

    await request(app).get("/api/data").set("x-api-key", apiKey).expect(200);
  });

  test("enforces daily rate limits", async () => {
    const createResponse = await request(app)
      .post("/api/clients")
      .send({
        name: "DayLimitedClient",
        perMinuteLimit: 100,
        perDayLimit: 2,
      })
      .expect(201);

    const apiKey = createResponse.body.apiKey;

    await request(app).get("/api/data").set("x-api-key", apiKey).expect(200);
    await request(app).get("/api/data").set("x-api-key", apiKey).expect(200);
    await request(app).get("/api/data").set("x-api-key", apiKey).expect(429);
  });

  test("returns 403 for disabled client", async () => {
    const createResponse = await request(app)
      .post("/api/clients")
      .send({
        name: "ToggleClient",
        perMinuteLimit: 10,
        perDayLimit: 100,
      })
      .expect(201);

    const { apiKey, _id: id } = createResponse.body;
    const token = await createAdminToken();

    await request(app)
      .patch(`/api/clients/${id}/toggle`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    await request(app).get("/api/data").set("x-api-key", apiKey).expect(403);
  });

  test("invalidates old API key after regenerate", async () => {
    const createResponse = await request(app)
      .post("/api/clients")
      .send({
        name: "RegenClient",
        perMinuteLimit: 10,
        perDayLimit: 100,
      })
      .expect(201);

    const { apiKey: oldKey, _id: id } = createResponse.body;
    const token = await createAdminToken();

    const regenResponse = await request(app)
      .post(`/api/clients/${id}/regenerate`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const newKey = regenResponse.body.data.apiKey;

    await request(app).get("/api/data").set("x-api-key", oldKey).expect(401);
    await request(app).get("/api/data").set("x-api-key", newKey).expect(200);
  });

  test("handles concurrent requests at limit boundary", async () => {
    const createResponse = await request(app)
      .post("/api/clients")
      .send({
        name: "ConcurrentClient",
        perMinuteLimit: 5,
        perDayLimit: 100,
      })
      .expect(201);

    const apiKey = createResponse.body.apiKey;
    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app).get("/api/data").set("x-api-key", apiKey)
      )
    );

    const allowed = responses.filter((res) => res.status === 200).length;
    const blocked = responses.filter((res) => res.status === 429).length;

    expect(allowed).toBe(5);
    expect(blocked).toBe(5);
  });
});
