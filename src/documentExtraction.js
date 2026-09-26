'use strict';

const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const { config } = require('./config');
const { stripControlCharacters } = require('./utils');

const PDF_TYPE = 'application/pdf';
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function documentError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function binaryDocumentType(document = {}) {
  const type = String(document.type || '').toLowerCase();
  const name = String(document.name || '').toLowerCase();
  if (type === PDF_TYPE || name.endsWith('.pdf')) return PDF_TYPE;
  if (type === DOCX_TYPE || name.endsWith('.docx')) return DOCX_TYPE;
  return null;
}

function decodeUpload(value, name) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(?:data:[^;,]+;base64,)?([A-Za-z0-9+/=\s]+)$/i);
  if (!match) throw documentError(`${name}: the document data is invalid.`);
  const encoded = match[1].replace(/\s/g, '');
  const bytes = Buffer.byteLength(encoded, 'base64');
  if (!bytes || bytes > config.maxFileBytes) throw documentError(`${name}: document exceeds the allowed size.`);
  return Buffer.from(encoded, 'base64');
}

function safeExtractedText(value, name) {
  const text = stripControlCharacters(value || '').trim();
  if (!text) throw documentError(`${name}: no readable text was found. Upload a text-based PDF/DOCX or a clear image.`);
  if (text.length > config.maxDocumentChars) return text.slice(0, config.maxDocumentChars);
  return text;
}

async function extractPdfText(buffer, name) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return safeExtractedText(result.text, name);
  } catch (error) {
    throw documentError(`${name}: PDF text could not be extracted.`);
  } finally {
    await parser.destroy().catch(() => {});
  }
}

async function extractDocxText(buffer, name) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return safeExtractedText(result.value, name);
  } catch (error) {
    throw documentError(`${name}: DOCX text could not be extracted.`);
  }
}

// Text files are already extracted by the browser. PDF and DOCX files arrive
// as bounded base64 data and are converted to plain text locally before the
// verification pipeline sees them. The original binary is intentionally dropped.
async function extractUploadedDocuments(documents) {
  if (!Array.isArray(documents)) return documents;
  if (documents.length > 5) throw documentError('A maximum of five documents can be analyzed in one run.');
  return Promise.all(documents.map(async (document, index) => {
    const type = binaryDocumentType(document);
    if (!type) return document;
    const name = stripControlCharacters(document?.name || `Document ${index + 1}`).slice(0, 120);
    const buffer = decodeUpload(document?.fileData, name);
    if (type === PDF_TYPE && !buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw documentError(`${name}: the uploaded file is not a valid PDF.`);
    if (type === DOCX_TYPE && !(buffer[0] === 0x50 && buffer[1] === 0x4b)) throw documentError(`${name}: the uploaded file is not a valid DOCX file.`);
    const content = type === PDF_TYPE ? await extractPdfText(buffer, name) : await extractDocxText(buffer, name);
    const { fileData, ...safeDocument } = document || {};
    return { ...safeDocument, name, type, kind: 'text', content };
  }));
}

module.exports = { PDF_TYPE, DOCX_TYPE, extractUploadedDocuments, extractPdfText, extractDocxText };
