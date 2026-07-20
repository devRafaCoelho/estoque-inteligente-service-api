const AppError = require("../utils/AppError");

const validateSchema = (schema, property = "body") => (req, _res, next) => {
  const { error, value } = schema.validate(req[property], {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.map((d) => d.message);
    return next(new AppError("Dados inválidos", 422, details));
  }

  req[property] = value;
  return next();
};

module.exports = validateSchema;
