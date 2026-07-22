const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const productRoutes = require("./productRoutes");
const intakeRoutes = require("./intakeRoutes");
const stockOutRoutes = require("./stockOutRoutes");
const shoppingListRoutes = require("./shoppingListRoutes");
const notificationRoutes = require("./notificationRoutes");
const dashboardRoutes = require("./dashboardRoutes");
const financeRoutes = require("./financeRoutes");

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
}

module.exports = setRoutes;
