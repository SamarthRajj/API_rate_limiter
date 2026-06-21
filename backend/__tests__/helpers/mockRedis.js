export function createMockRedis() {
  const store = new Map();

  const getVal = (key) => (store.has(key) ? store.get(key) : null);

  const redis = {
    store,
    get: async (key) => getVal(key),
    set: async (key, value) => {
      store.set(key, value);
    },
    setEx: async (key, _ttl, value) => {
      store.set(key, value);
    },
    del: async (...keys) => {
      const flat = keys.flat();
      flat.forEach((key) => store.delete(key));
      return flat.length;
    },
    mGet: async (...keys) => keys.map((key) => getVal(key)),
    incr: async (key) => {
      const next = parseInt(getVal(key) || "0", 10) + 1;
      store.set(key, String(next));
      return next;
    },
    expire: async () => true,
    keys: async (pattern) => {
      const prefix = pattern.replace("*", "");
      return [...store.keys()].filter((key) => key.startsWith(prefix));
    },
    multi() {
      const commands = [];
      const chain = {
        incr(key) {
          commands.push(["incr", key]);
          return chain;
        },
        expire(key, seconds) {
          commands.push(["expire", key, seconds]);
          return chain;
        },
        async exec() {
          for (const [cmd, key] of commands) {
            if (cmd === "incr") {
              await redis.incr(key);
            }
          }
          return commands.map(() => [null, "OK"]);
        },
      };
      return chain;
    },
  };

  return redis;
}

export function createMockIo() {
  return { emit: () => {} };
}

export function createMockReq(app, apiKey) {
  return {
    app,
    headers: apiKey ? { "x-api-key": apiKey } : {},
  };
}

export function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}
