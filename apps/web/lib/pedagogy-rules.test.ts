import { describe, expect, it } from "vitest";
import {
  durationIssue,
  formatBytes,
  kindFromMime,
  materialDraftIssue,
  maxBytesFor,
  mimeForExtension,
  nextPosition,
  normalizeHttpUrl,
  parseDateInput,
  storagePathIssue,
} from "./pedagogy-rules";

describe("kindFromMime", () => {
  it("reconhece cada família aceita", () => {
    expect(kindFromMime("video/mp4")).toBe("video");
    expect(kindFromMime("audio/mpeg")).toBe("audio");
    expect(kindFromMime("image/png")).toBe("image");
    expect(kindFromMime("application/pdf")).toBe("pdf");
  });

  it("ignora o charset e o caixa do mimetype", () => {
    expect(kindFromMime("AUDIO/OGG; codecs=opus")).toBe("audio");
  });

  it("recusa o que não está na lista", () => {
    expect(kindFromMime("application/zip")).toBeNull();
    expect(kindFromMime("")).toBeNull();
  });
});

describe("extensão e tamanho", () => {
  it("mapeia extensão para mimetype", () => {
    expect(mimeForExtension(".mp4")).toBe("video/mp4");
    expect(mimeForExtension("pdf")).toBe("application/pdf");
    expect(mimeForExtension("exe")).toBeNull();
  });

  it("limita por tipo: vídeo é o maior, imagem o menor", () => {
    expect(maxBytesFor("video")).toBeGreaterThan(maxBytesFor("audio"));
    expect(maxBytesFor("audio")).toBeGreaterThan(maxBytesFor("image"));
    expect(maxBytesFor("text")).toBe(0);
  });

  it("formata tamanho em unidade legível", () => {
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB".replace(".", ","));
    expect(formatBytes(500 * 1024)).toBe("500 KB");
  });
});

describe("normalizeHttpUrl", () => {
  it("aceita http e https", () => {
    expect(normalizeHttpUrl("https://youtu.be/abc")).toBe("https://youtu.be/abc");
    expect(normalizeHttpUrl("http://escola.com.br/video")).toBe("http://escola.com.br/video");
  });

  it("completa www. com https", () => {
    expect(normalizeHttpUrl("www.escola.com.br/aula")).toBe("https://www.escola.com.br/aula");
  });

  it("recusa esquema que executa ou lê a máquina", () => {
    expect(normalizeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeHttpUrl("file:///etc/passwd")).toBeNull();
    expect(normalizeHttpUrl("data:text/html,<script>")).toBeNull();
  });

  it("recusa endereço sem host ou com credencial embutida", () => {
    expect(normalizeHttpUrl("https://")).toBeNull();
    expect(normalizeHttpUrl("https://user:senha@escola.com.br")).toBeNull();
    expect(normalizeHttpUrl("texto solto")).toBeNull();
  });
});

describe("materialDraftIssue", () => {
  it("texto precisa de corpo", () => {
    expect(materialDraftIssue({ kind: "text", title: "Passe", bodyText: "   " })).toBe(
      "Escreva o texto do conteúdo.",
    );
    expect(materialDraftIssue({ kind: "text", title: "Passe", bodyText: "Apoio de pé" })).toBeNull();
  });

  it("link precisa ser http(s)", () => {
    expect(materialDraftIssue({ kind: "link", title: "Vídeo", url: "youtube.com/x" })).toContain(
      "https://",
    );
    expect(
      materialDraftIssue({ kind: "link", title: "Vídeo", url: "https://youtu.be/x" }),
    ).toBeNull();
  });

  it("arquivo precisa de pathname, tipo e tamanho coerentes", () => {
    const path = "private/s1/materials/video/abc.mp4";

    expect(
      materialDraftIssue({
        kind: "video",
        title: "Treino",
        storagePath: path,
        mime: "video/mp4",
        sizeBytes: 1024,
      }),
    ).toBeNull();

    expect(
      materialDraftIssue({ kind: "video", title: "Treino", storagePath: "", mime: "video/mp4", sizeBytes: 1 }),
    ).toBe("Envie o arquivo antes de salvar.");

    expect(
      materialDraftIssue({
        kind: "video",
        title: "Treino",
        storagePath: path,
        mime: "application/pdf",
        sizeBytes: 1,
      }),
    ).toBe("O arquivo enviado não é do tipo escolhido.");

    expect(
      materialDraftIssue({
        kind: "image",
        title: "Foto",
        storagePath: path,
        mime: "image/jpeg",
        sizeBytes: maxBytesFor("image") + 1,
      }),
    ).toContain("limite");
  });

  it("título vazio barra qualquer tipo", () => {
    expect(materialDraftIssue({ kind: "text", title: " ", bodyText: "x" })).toBe(
      "Dê um título ao conteúdo.",
    );
  });
});

describe("storagePathIssue", () => {
  it("recusa arquivo de outra escola", () => {
    expect(
      storagePathIssue("private/outra/materials/pdf/a.pdf", "application/pdf", "pdf", 10, "s1"),
    ).toBe("O arquivo não pertence a esta escola.");
  });

  it("aceita arquivo dentro da pasta da escola", () => {
    expect(
      storagePathIssue("private/s1/materials/pdf/a.pdf", "application/pdf", "pdf", 10, "s1"),
    ).toBeNull();
  });
});

describe("parseDateInput", () => {
  it("lê a data do formulário como UTC (o dia não desloca)", () => {
    const date = parseDateInput("2026-03-10");
    expect(date?.toISOString()).toBe("2026-03-10T00:00:00.000Z");
  });

  it("recusa data inexistente e formato livre", () => {
    expect(parseDateInput("2026-02-30")).toBeNull();
    expect(parseDateInput("10/03/2026")).toBeNull();
    expect(parseDateInput("")).toBeNull();
  });
});

describe("durationIssue", () => {
  it("aceita entre 15 e 180 minutos", () => {
    expect(durationIssue(15)).toBeNull();
    expect(durationIssue(90)).toBeNull();
    expect(durationIssue(180)).toBeNull();
  });

  it("recusa fora da faixa e fração", () => {
    expect(durationIssue(10)).toContain("15 e 180");
    expect(durationIssue(200)).toContain("15 e 180");
    expect(durationIssue(60.5)).toBe("Duração em minutos inteiros.");
  });
});

describe("nextPosition", () => {
  it("começa em 1 e continua depois do maior", () => {
    expect(nextPosition([])).toBe(1);
    expect(nextPosition([1, 2, 3])).toBe(4);
    expect(nextPosition([7])).toBe(8);
  });
});
