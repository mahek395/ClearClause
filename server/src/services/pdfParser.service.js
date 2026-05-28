import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

import Tesseract from 'tesseract.js';
import { pdf as pdfToImg } from 'pdf-to-img';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// ---------------------------------------------
// Resolve __dirname in ES Modules
// ---------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------
// Path to Tesseract traineddata files
// server/
//   ├── eng.traineddata
//   ├── hin.traineddata
//   └── src/services/pdfParser.service.js
// ---------------------------------------------
const TESSDATA_PATH = path.resolve(__dirname, '../../../');

// ---------------------------------------------
// Extract text using PDF.js
// ---------------------------------------------
async function extractTextWithPdfJs(filePath) {
  const buffer = fs.readFileSync(filePath);
  const uint8Array = new Uint8Array(buffer);

  const loadingTask = pdfjsLib.getDocument({
    data: uint8Array,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;

  let fullText = '';
  const numPages = pdf.numPages;

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);

    const textContent = await page.getTextContent();

    const pageText = textContent.items
      .map((item) => item.str)
      .join(' ');

    fullText += pageText + '\n';
  }

  return {
    text: fullText.trim(),
    pageCount: numPages,
  };
}

// ---------------------------------------------
// Main PDF extraction function
// ---------------------------------------------
export async function extractTextFromPDF(filePath) {
  try {
    // First attempt: normal extraction
    const {
      text: extractedText,
      pageCount,
    } = await extractTextWithPdfJs(filePath);

    // Detect scanned PDFs
    const isScanned =
      extractedText.length < 150 && pageCount >= 1;

    // Normal text PDF
    if (!isScanned) {
      console.log(
        `[PDF] ✅ Text extracted — ${extractedText.length} chars, ${pageCount} pages`
      );

      return {
        text: extractedText,
        pageCount,
        isScanned: false,
      };
    }

    // ---------------------------------------------
    // OCR fallback
    // ---------------------------------------------
    console.log(
      '[PDF] 🔍 Scanned PDF detected — running OCR...'
    );

    const pagesToProcess = Math.min(pageCount, 10);

    let ocrText = '';
    let pageNum = 0;

    // Convert PDF pages to images
    const doc = await pdfToImg(filePath, {
      scale: 2,
    });

    for await (const pageBuffer of doc) {
      pageNum++;

      if (pageNum > pagesToProcess) break;

      console.log(
        `[OCR] Processing page ${pageNum}/${pagesToProcess}`
      );

      // Temp image path
      const tmpPath = path.join(
        os.tmpdir(),
        `lexsimple_${Date.now()}_p${pageNum}.png`
      );

      fs.writeFileSync(tmpPath, pageBuffer);

      try {
        // OCR with English + Hindi support
        const {
          data: { text },
        } = await Tesseract.recognize(
          tmpPath,
          'eng+hin',
          {
            langPath: TESSDATA_PATH,
            logger: () => {},
          }
        );

        ocrText += `\n${text}`;
      } finally {
        // Cleanup temp image
        if (fs.existsSync(tmpPath)) {
          fs.unlinkSync(tmpPath);
        }
      }
    }

    console.log(
      `[OCR] ✅ Done — ${ocrText.trim().length} chars extracted`
    );

    return {
      text: ocrText.trim(),
      pageCount,
      isScanned: true,
    };
  } catch (error) {
    console.error('[PDF] ❌ Error:', error.message);
    throw error;
  }
}