// middlewares/errorHandler.js
import logger from "../utils/logger.js";
import ApiError from "../utils/ApiError.js";

const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;

  // Default to 500 if not set
  if (!statusCode || statusCode === 200) {
    statusCode = 500;
  }

  // Default error message
  if (!message) {
    message = "Internal server error";
  }

  // Log error
  const logMessage = `${req.method} ${req.path} - ${statusCode} - ${message}`;
  if (statusCode >= 500) {
    logger.error(logMessage, { error: err.stack });
  } else {
    logger.warn(logMessage);
  }

  // Send error response
  const response = {
    success: false,
    statusCode,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  };

  res.status(statusCode).json(response);
};

export default errorHandler;

