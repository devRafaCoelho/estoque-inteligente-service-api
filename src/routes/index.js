const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const productRoutes = require("./productRoutes");
const intakeRoutes = require("./intakeRoutes");
const stockOutRoutes = require("./stockOutRoutes");
const shoppingListRoutes = require("./shoppingListRoutes");

function setRoutes(app) {
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/intakes", intakeRoutes);
  app.use("/api/stock-outs", stockOutRoutes);
  app.use("/api/shopping-lists", shoppingListRoutes);
}

module.exports = setRoutes;
