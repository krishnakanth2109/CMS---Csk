import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

async function extractTextFromFile(buffer, filename) {
  const extension = String(filename || "").toLowerCase().split(".").pop();

  try {
    if (extension === "pdf") {
      const result = await pdfParse(buffer);
      return (result.text || "").trim();
    }

    if (extension === "docx" || extension === "doc") {
      const result = await mammoth.extractRawText({ buffer });
      return (result.value || "").trim();
    }

    return buffer.toString("utf8").trim();
  } catch (error) {
    const fallback = buffer.toString("utf8").trim();
    if (fallback) {
      return fallback;
    }
    throw new Error(`Unable to process file ${filename}. Supported formats: PDF, DOCX, TXT`);
  }
}

export { 
  extractTextFromFile
 };
