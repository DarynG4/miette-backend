// guards against requests with missing or empty bodies on routes that require one
// applied to POST and PATCH routes before the route handler runs
// prevents route handlers from having to check req.body themselves

const requireBody = (req, res, next) => {
  // object.keys() returns an array of an object's own enumerable property names
  // if req.body is an empty objects then objects.keys({}) returns [] and .length is 0
  // catches the case where a req.body was technically sent but contains nothing
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: "Request body is required." });
  }

  next();
};

export default requireBody;
