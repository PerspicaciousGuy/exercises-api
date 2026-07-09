export class AppError extends Error {
  constructor({ statusCode, code, message, retryAfterSeconds }) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
