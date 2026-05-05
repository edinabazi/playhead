import { basename, extname } from "node:path";

export function makeId(value: string): string {
  return Buffer.from(value).toString("base64url");
}

export function cleanTitle(filePath: string): string {
  return basename(filePath, extname(filePath)).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}
