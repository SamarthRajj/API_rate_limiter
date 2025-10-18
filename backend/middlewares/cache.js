// middlewares/cache.js
import redisClient from "../utils/redisClient.js";
import logger from "../utils/logger.js";

// Cache middleware factory
const cacheMiddleware = (ttlSeconds = 30) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    const cacheKey = `cache:${req.originalUrl || req.url}`;

    try {
      // Try to get cached data
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        logger.debug(`Cache hit: ${cacheKey}`);
        res.setHeader("X-Cache", "HIT");
        return res.json(JSON.parse(cachedData));
      }

      // Cache miss - store original json method
      logger.debug(`Cache miss: ${cacheKey}`);
      res.setHeader("X-Cache", "MISS");
      
      const originalJson = res.json.bind(res);
      res.json = (data) => {
        // Store in cache
        redisClient.setEx(cacheKey, ttlSeconds, JSON.stringify(data))
          .catch(err => logger.error(`Cache set error: ${err.message}`));
        
        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error(`Cache middleware error: ${error.message}`);
      next(); // Continue without caching on error
    }
  };
};

export default cacheMiddleware;

