import { describe, expect, it } from "vitest";
import { defaultBaseURL, trustedOriginsFrom } from "../base-url";

describe("defaultBaseURL", () => {
  it("prefere o endereço configurado", () => {
    expect(defaultBaseURL({ BETTER_AUTH_URL: "https://nextgen.app" })).toBe("https://nextgen.app");
  });

  it("usa o domínio estável em produção, não a URL da implantação", () => {
    const url = defaultBaseURL({
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "nextgen-autoric.vercel.app",
      VERCEL_URL: "nextgen-abc123-autoric.vercel.app",
    });

    expect(url).toBe("https://nextgen-autoric.vercel.app");
  });

  it("mantém a URL da implantação em preview: o link precisa voltar para ela", () => {
    const url = defaultBaseURL({
      VERCEL_ENV: "preview",
      VERCEL_PROJECT_PRODUCTION_URL: "nextgen-autoric.vercel.app",
      VERCEL_URL: "nextgen-abc123-autoric.vercel.app",
    });

    expect(url).toBe("https://nextgen-abc123-autoric.vercel.app");
  });

  it("cai no localhost fora da Vercel", () => {
    expect(defaultBaseURL({})).toBe("http://localhost:3000");
  });
});

describe("trustedOriginsFrom", () => {
  it("aceita os domínios do projeto, não só o baseURL", () => {
    const origins = trustedOriginsFrom({
      VERCEL_PROJECT_PRODUCTION_URL: "nextgen-three-ebon.vercel.app",
      VERCEL_URL: "nextgen-abc123-autoric.vercel.app",
    });

    expect(origins).toEqual([
      "https://nextgen-three-ebon.vercel.app",
      "https://nextgen-abc123-autoric.vercel.app",
    ]);
  });

  it("inclui domínio próprio declarado à parte", () => {
    const origins = trustedOriginsFrom({
      VERCEL_URL: "nextgen-abc.vercel.app",
      BETTER_AUTH_TRUSTED_ORIGINS: "https://nextgen.app, https://www.nextgen.app",
    });

    expect(origins).toContain("https://nextgen.app");
    expect(origins).toContain("https://www.nextgen.app");
  });

  it("não repete origem", () => {
    const origins = trustedOriginsFrom({
      VERCEL_PROJECT_PRODUCTION_URL: "nextgen.vercel.app",
      VERCEL_URL: "nextgen.vercel.app",
    });

    expect(origins).toEqual(["https://nextgen.vercel.app"]);
  });
});
