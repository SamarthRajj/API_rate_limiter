// middlewares/auth.js
import jwt from "jsonwebtoken";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";

const authMiddleware = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError(401, "No token provided, authorization denied");
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const jwtSecret = process.env.ADMIN_JWT_SECRET || "default_secret_change_in_production";
    const decoded = jwt.verify(token, jwtSecret);

    // Add user from payload to request
    req.admin = decoded;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      logger.warn(`Invalid token: ${error.message}`);
      return next(new ApiError(401, "Invalid token"));
    }
    if (error.name === "TokenExpiredError") {
      logger.warn("Token expired");
      return next(new ApiError(401, "Token expired"));
    }
    next(error);
  }
};

export default authMiddleware;

