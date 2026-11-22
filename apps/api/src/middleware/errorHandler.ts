import type { ApiErrorBody } from "@catalogue/shared";
import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../errors";

export function notFoundHandler(_req: Request, res: Response<ApiErrorBody>): void {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: "Route not found" },
  });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response<ApiErrorBody>,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  // express.json() rejects malformed bodies before any route runs. That is a
  // client mistake, so answer with the standard validation envelope.
  if (isBodyParseError(err)) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" },
    });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
  });
}

function isBodyParseError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    (error as { type?: unknown }).type === "entity.parse.failed"
  );
}
