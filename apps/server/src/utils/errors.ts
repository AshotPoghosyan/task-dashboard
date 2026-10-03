/** Error with an HTTP status and a stable machine-readable code. */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static notFound(what: string): AppError {
    return new AppError(404, 'NOT_FOUND', `${what} not found`);
  }

  static badRequest(code: string, message: string): AppError {
    return new AppError(400, code, message);
  }

  static unprocessable(code: string, message: string): AppError {
    return new AppError(422, code, message);
  }
}
