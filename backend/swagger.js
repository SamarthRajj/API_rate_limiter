// swagger.js
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Rate Limiter API",
      version: "1.0.0",
      description: "API documentation for Rate Limiter & Monitoring Service",
      contact: {
        name: "API Support",
      },
    },
    servers: [
      {
        url: process.env.API_URL || "http://localhost:5000",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT token",
        },
        apiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description: "API key for rate-limited endpoints",
        },
      },
    },
    tags: [
      {
        name: "Authentication",
        description: "Admin authentication endpoints",
      },
      {
        name: "Clients",
        description: "Client management endpoints",
      },
      {
        name: "Usage",
        description: "Usage statistics endpoints",
      },
      {
        name: "API",
        description: "Protected API endpoints",
      },
    ],
  },
  apis: ["./routes/*.js"], // Path to the API routes
};

const specs = swaggerJsdoc(options);

const setupSwagger = (app) => {
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(specs, {
      explorer: true,
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "Rate Limiter API Docs",
    })
  );
};

export default setupSwagger;

