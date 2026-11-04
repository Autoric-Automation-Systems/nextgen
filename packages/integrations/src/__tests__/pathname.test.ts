import { describe, expect, it } from "vitest";
import {
  MAX_BYTES,
  buildPathname,
  extensionFor,
  isAllowedMime,
  pathnameBelongsToSchool,
} from "../storage/pathname";

const SCHOOL = "01930000-0000-7000-8000-000000000001";
const OTHER = "01930000-0000-7000-8000-000000000002";

describe("buildPathname", () => {
  it("monta caminho com area e escola", () => {
    const pathname = buildPathname({
      schoolId: SCHOOL,
      area: "private",
      kind: "video",
      scope: "students/abc/video",
      mime: "video/mp4",
      token: "t1",
    });
    expect(pathname).toBe(`private/${SCHOOL}/students/abc/video-t1.mp4`);
  });

  it("rejeita schoolId que não é uuid", () => {
    expect(() =>
      buildPathname({ schoolId: "../etc", area: "public", kind: "image", scope: "a", mime: "image/png", token: "t" }),
    ).toThrow(/schoolId/);
  });

  it("rejeita travessia de diretório no scope", () => {
    expect(() =>
      buildPathname({ schoolId: SCHOOL, area: "public", kind: "image", scope: "../../outra", mime: "image/png", token: "t" }),
    ).toThrow(/scope/);
  });
});

describe("pathnameBelongsToSchool", () => {
  it("aceita caminho da própria escola", () => {
    expect(pathnameBelongsToSchool(`private/${SCHOOL}/students/a/x.png`, SCHOOL)).toBe(true);
  });

  it("rejeita caminho de outra escola", () => {
    expect(pathnameBelongsToSchool(`private/${OTHER}/students/a/x.png`, SCHOOL)).toBe(false);
  });

  it("rejeita area desconhecida e caminho raso", () => {
    expect(pathnameBelongsToSchool(`tmp/${SCHOOL}/a.png`, SCHOOL)).toBe(false);
    expect(pathnameBelongsToSchool(`private/${SCHOOL}`, SCHOOL)).toBe(false);
  });
});

describe("mime", () => {
  it("aceita tipos previstos e recusa o resto", () => {
    expect(isAllowedMime("image", "image/webp")).toBe(true);
    expect(isAllowedMime("image", "image/svg+xml")).toBe(false);
    expect(isAllowedMime("document", "application/pdf")).toBe(true);
    expect(isAllowedMime("document", "application/zip")).toBe(false);
  });

  it("mapeia extensão", () => {
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("application/x-msdownload")).toBe("bin");
  });
});

describe("limites", () => {
  it("tem limite por tipo", () => {
    expect(MAX_BYTES.video).toBeGreaterThan(MAX_BYTES.image);
    expect(MAX_BYTES.avatar).toBeLessThanOrEqual(MAX_BYTES.image);
  });
});
