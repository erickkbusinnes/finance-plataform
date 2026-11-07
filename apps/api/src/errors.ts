export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
export function check(condition: unknown, code: number, message: string): asserts condition {
  if (!condition) throw new AppError(code, message);
}
