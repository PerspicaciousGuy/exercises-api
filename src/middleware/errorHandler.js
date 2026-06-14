export function errorHandler(error, _request, response, _next) {
  const statusCode = Number.isInteger(error.statusCode)
    ? error.statusCode
    : 500;

  response.status(statusCode).json({
    success: false,
    error: {
      code: error.code ?? 'INTERNAL_SERVER_ERROR',
      message:
        statusCode >= 500 ? 'An unexpected error occurred' : error.message
    }
  });
}
