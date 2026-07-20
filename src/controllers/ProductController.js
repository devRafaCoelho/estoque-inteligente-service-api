const ProductService = require("../services/ProductService");

const ProductController = {
  async list(req, res) {
    const products = await ProductService.list(req.user.id, req.query);
    return res.status(200).json({ products });
  },

  async get(req, res) {
    const product = await ProductService.get(req.user.id, req.params.id);
    return res.status(200).json({ product });
  },

  async create(req, res) {
    const product = await ProductService.create(req.user.id, req.body);
    return res.status(201).json({ product });
  },

  async update(req, res) {
    const product = await ProductService.update(req.user.id, req.params.id, req.body);
    return res.status(200).json({ product });
  },

  async consume(req, res) {
    const product = await ProductService.consume(req.user.id, req.params.id, req.body);
    return res.status(200).json({ product });
  },

  async markOut(req, res) {
    const product = await ProductService.markOut(req.user.id, req.params.id);
    return res.status(200).json({ product });
  },
};

module.exports = ProductController;
