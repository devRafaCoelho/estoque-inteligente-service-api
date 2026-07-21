const swaggerUi = require("swagger-ui-express");
const openapi = require("./openapi");

function setupSwagger(app) {
  app.get("/api-docs.json", (_req, res) => {
    res.json(openapi);
  });

  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(openapi, {
      customSiteTitle: "Estoque Inteligente API",
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
      },
    }),
  );
}

module.exports = setupSwagger;
