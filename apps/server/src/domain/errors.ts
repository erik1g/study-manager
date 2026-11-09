/** An error the web app can show: `code` selects the German message. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export const notFound = (what = "not_found") => new AppError(404, what);
export const forbidden = (what = "forbidden") => new AppError(403, what);
export const invalid = (what: string, message?: string) => new AppError(400, what, message);
