const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const productRoutes = require("./productRoutes");
const intakeRoutes = require("./intakeRoutes");
const stockOutRoutes = require("./stockOutRoutes");
const shoppingListRoutes = require("./shoppingListRoutes");
const notificationRoutes = require("./notificationRoutes");
const dashboardRoutes = require("./dashboardRoutes");
const financeRoutes = require("./financeRoutes");
const productCategoryRoutes = require("./productCategoryRoutes");
const stockUnitRoutes = require("./stockUnitRoutes");
const brazilianStateRoutes = require("./brazilianStateRoutes");
const chatRoutes = require("./chatRoutes");
const shoppingListShareRoutes = require("./shoppingListShareRoutes");

function setRoutes(app) {
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/intakes", intakeRoutes);
  app.use("/api/stock-outs", stockOutRoutes);
  app.use("/api/shopping-lists", shoppingListRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/finance", financeRoutes);
  app.use("/api/product-categories", productCategoryRoutes);
  app.use("/api/stock-units", stockUnitRoutes);
  app.use("/api/brazilian-states", brazilianStateRoutes);
  app.use("/api/chat", chatRoutes);
  app.use("/api/shopping-lists/shares", shoppingListShareRoutes);
}

module.exports = setRoutes;
