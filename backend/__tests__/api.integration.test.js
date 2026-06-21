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

    await request(app)
      .post("/api/auth/register")
      .send({ username: "testadmin", password: "testpass123" })
      .expect(201);

    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({ username: "testadmin", password: "testpass123" })
      .expect(200);

    const token = loginResponse.body.data.token;

    await request(app)
      .put(`/api/clients/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ perMinuteLimit: 10 })
      .expect(200);

    await request(app).get("/api/data").set("x-api-key", apiKey).expect(200);
  });
});
