import { randomUUID } from "node:crypto";
import type { TravelSource } from "@/lib/travel/types";
import { normalizeTravelSource } from "@/lib/travel/utils";

function extractFirstMatch(pattern: RegExp, html: string) {
  const match = pattern.exec(html);
  return match?.[1]?.trim() || "";
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trim()}…`;
}

function getMetaContent(html: string, property: string) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);

    if (match?.[1]) {
      return decodeHtmlEntities(match[1].trim());
    }
  }

  return "";
}

function extractAuthor(html: string) {
  const metaAuthor = getMetaContent(html, "author");

  if (metaAuthor) {
    return metaAuthor;
  }

  const ldJsonMatches = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  if (!ldJsonMatches) {
    return "";
  }

  for (const block of ldJsonMatches) {
    const jsonText = block
      .replace(/<script[^>]*>/i, "")
      .replace(/<\/script>/i, "")
      .trim();

    try {
      const payload = JSON.parse(jsonText) as
        | { author?: { name?: string } | string }
        | Array<{ author?: { name?: string } | string }>;
      const items = Array.isArray(payload) ? payload : [payload];

      for (const item of items) {
        if (typeof item.author === "string" && item.author.trim()) {
          return item.author.trim();
        }

        if (
          item.author &&
          typeof item.author === "object" &&
          typeof item.author.name === "string" &&
          item.author.name.trim()
        ) {
          return item.author.name.trim();
        }
      }
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }

  return "";
}

function normalizeUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  return url.toString();
}

export async function parseTravelSource(urlInput: string): Promise<TravelSource> {
  const requestedUrl = normalizeUrl(urlInput);

  try {
    const response = await fetch(requestedUrl, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "cache-control": "no-cache",
        pragma: "no-cache",
      },
      redirect: "follow",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`链接抓取失败（${response.status}）。`);
    }

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("text/html")) {
      throw new Error("链接未返回可解析的网页内容。");
    }

    const html = await response.text();
    const finalUrl = normalizeUrl(response.url || requestedUrl);
    const title =
      getMetaContent(html, "og:title") ||
      decodeHtmlEntities(extractFirstMatch(/<title[^>]*>([\s\S]*?)<\/title>/i, html));
    const excerpt =
      getMetaContent(html, "og:description") ||
      getMetaContent(html, "description") ||
      getMetaContent(html, "twitter:description");
    const coverImage =
      getMetaContent(html, "og:image") || getMetaContent(html, "twitter:image");
    const canonical =
      extractFirstMatch(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i, html) ||
      finalUrl;
    const visibleText = truncate(stripHtml(html), 3600);
    const author = extractAuthor(html);

    if (!title && !excerpt && !visibleText) {
      throw new Error("链接内容可访问，但没有提取到可用攻略信息。");
    }

    return normalizeTravelSource({
      id: randomUUID(),
      url: canonical || finalUrl,
      status: "parsed",
      title: truncate(title, 140),
      author: truncate(author, 80),
      coverImage,
      excerpt: truncate(excerpt, 240),
      contentText: visibleText,
      manualSummary: "",
      error: "",
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return normalizeTravelSource({
      id: randomUUID(),
      url: requestedUrl,
      status: "error",
      title: "",
      author: "",
      coverImage: "",
      excerpt: "",
      contentText: "",
      manualSummary: "",
      error:
        error instanceof Error ? error.message : "链接解析失败，请手动补充攻略摘要。",
      fetchedAt: new Date().toISOString(),
    });
  }
}
