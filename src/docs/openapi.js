const { components } = require("./components");
const paths = require("./paths");

const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Estoque Inteligente API",
    version: "1.0.0",
    description:
      "API v1 — autenticação, estoque, intake/baixa, lista, alertas, dashboard e financeiro.",
  },
  servers: [
    {
      url: "http://localhost:3001",
      description: "Desenvolvimento local",
    },
  ],
  tags: [
    { name: "Health", description: "Disponibilidade" },
    { name: "Auth", description: "Cadastro, login e sessão" },
    { name: "Users", description: "Perfil e conta" },
    { name: "Products", description: "Estoque e baixas manuais" },
    { name: "Intakes", description: "Entrada de compra (texto → preview → confirm)" },
    { name: "ShoppingLists", description: "Lista de compras (regras + paper)" },
    { name: "Notifications", description: "Alertas in-app (estoque baixo/zerado)" },
    { name: "Dashboard", description: "Resumo e métricas" },
    { name: "Finance", description: "Gastos a partir de compras com preço" },
  ],
  components,
  security: [{ bearerAuth: [] }],
  paths,
};

module.exports = openapi;
