type Env = {
  ASSETS: { fetch: typeof fetch };
  API_ORIGIN?: string;
};

const DEFAULT_API_ORIGIN = "https://lucepress-gestion.netlify.app";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const isApi =
      url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/storage/");

    if (!isApi) {
      return env.ASSETS.fetch(request);
    }

    const origin = (env.API_ORIGIN || DEFAULT_API_ORIGIN).replace(/\/$/, "");
    const target = new URL(url.pathname + url.search, origin);
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.set("x-forwarded-host", url.host);
    headers.set("x-forwarded-proto", url.protocol.replace(":", ""));
    headers.set("x-lucepress-public-origin", url.origin);

    const init: RequestInit = {
      method: request.method,
      headers,
      redirect: "manual",
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
      (init as { duplex?: string }).duplex = "half";
    }

    const upstream = await fetch(target, init);
    const out = new Headers(upstream.headers);
    out.set("x-lucepress-edge", "cloudflare");
    out.set("x-lucepress-api-origin", origin);
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: out,
    });
  },
};
