import { describe, expect, it } from "vitest";
import { buildExportFileName, exportFormatLabels, EXPORT_FORMATS } from "../utils/documentExport";

// S3-005 / S3-BR-006
// These tests cover the frontend export helper logic used by Library and Job Detail.
// Backend still owns the real file conversion endpoint, but the frontend must only
// expose the supported output formats and produce clean download filenames.
describe("documentExport - S3-005 export workflow helpers", () => {
  it("supports the defined export formats", () => {
    expect(EXPORT_FORMATS).toEqual(["pdf", "docx", "txt"]);
    expect(exportFormatLabels).toEqual({
      pdf: "PDF",
      docx: "DOCX",
      txt: "TXT",
    });
  });

  it("builds a clean filename from the document title", () => {
    const fileName = buildExportFileName({ title: "Software Engineer Resume v2" }, "pdf");

    expect(fileName).toBe("Software_Engineer_Resume_v2.pdf");
  });

  it("replaces an existing supported extension with the requested export format", () => {
    const fileName = buildExportFileName({ file_name: "cover_letter.docx" }, "txt");

    expect(fileName).toBe("cover_letter.txt");
  });

  it("falls back to a generic document filename when no usable name exists", () => {
    const fileName = buildExportFileName({ title: "!!!" }, "docx");

    expect(fileName).toBe("document.docx");
  });
});
