export function errorHandler(err, req, res, next) {
  console.error('[Error]', err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Something went wrong',
  });
}