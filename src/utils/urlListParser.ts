export interface ParsedUrlList {
  name?: string;
  urls: string[];
}

function isValidUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.hostname.length > 0
    );
  } catch {
    return false;
  }
}

function filterAndValidateUrls(rawUrls: string[]): string[] {
  return rawUrls
    .map((u) => u.trim())
    .filter((u) => u.length > 0)
    .filter((u) => !u.startsWith("#"))
    .filter(isValidUrl);
}

function parseTxt(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const urls: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    urls.push(trimmed);
  }
  return filterAndValidateUrls(urls);
}

function parseJson(content: string): { name?: string; urls: string[] } {
  const data = JSON.parse(content);
  let name: string | undefined;
  let rawUrls: string[];

  if (Array.isArray(data)) {
    rawUrls = data.filter((item): item is string => typeof item === "string");
  } else if (data && typeof data.urls === "object") {
    name = typeof data.name === "string" ? data.name : undefined;
    rawUrls = Array.isArray(data.urls)
      ? (data.urls as unknown[]).filter((item): item is string => typeof item === "string")
      : [];
  } else {
    return { urls: [] };
  }

  return {
    name,
    urls: filterAndValidateUrls(rawUrls),
  };
}

function parseCsv(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const urls: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;
    const firstCol = trimmed.split(/[,\t]/)[0]?.trim() ?? "";
    if (!firstCol || firstCol.startsWith("#")) continue;
    if (i === 0 && /^url|^link|^src|^href/i.test(firstCol)) continue;
    urls.push(firstCol);
  }
  return filterAndValidateUrls(urls);
}

/**
 * Parse a URL list file based on its format.
 * Supports .txt (one URL per line), .json (object with urls array or simple array), .csv (URL in first column).
 */
export function parseUrlListFile(
  content: string,
  filename: string
): ParsedUrlList {
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  switch (ext) {
    case "txt":
      return { urls: parseTxt(content) };
    case "json": {
      try {
        const result = parseJson(content);
        return { name: result.name, urls: result.urls };
      } catch {
        return { urls: [] };
      }
    }
    case "csv":
      return { urls: parseCsv(content) };
    default:
      return { urls: parseTxt(content) };
  }
}
