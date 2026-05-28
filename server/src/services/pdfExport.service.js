// services/pdfExport.service.js
// Generates a styled PDF summary of a LexSimple analysis using pdfkit.
// Install: npm install pdfkit
//
// Fixed:
//  - document_type field now matches analyzeDocument.service.js output
//  - summary field now matches analyzeDocument.service.js output
//  - section headings use s.heading (matches new prompt output)
//  - missing_clauses handles {clause, why_it_matters} object shape
//  - risk_reason only rendered for high/medium sections
//  - who_benefits now renders per-section in the breakdown

import PDFDocument from 'pdfkit';

// ─── Design Tokens ────────────────────────────────────────────────────────────

const C = {
  primary:   '#1e3a5f',
  accent:    '#3b82f6',
  high:      '#ef4444',
  highBg:    '#fef2f2',
  medium:    '#f59e0b',
  mediumBg:  '#fffbeb',
  low:       '#22c55e',
  lowBg:     '#f0fdf4',
  neutral:   '#6b7280',
  neutralBg: '#f9fafb',
  text:      '#1f2937',
  muted:     '#6b7280',
  border:    '#e5e7eb',
  lightBlue: '#dbeafe',
  white:     '#ffffff',
};

// Risk level display config — single source of truth used by both
// the pill counters and the per-section badges
const RISK_CONFIG = {
  high:    { label: 'HIGH RISK',    color: C.high,    bg: C.highBg,    icon: '⚠' },
  medium:  { label: 'MEDIUM RISK',  color: C.medium,  bg: C.mediumBg,  icon: '⚠' },
  low:     { label: 'LOW RISK',     color: C.low,     bg: C.lowBg,     icon: '✓' },
  neutral: { label: 'NEUTRAL',      color: C.neutral, bg: C.neutralBg, icon: 'i' },
};

// ─── Main Export Function ─────────────────────────────────────────────────────

/**
 * Streams a PDF to `res` (Express response object).
 *
 * @param {Object} docData   - Row from `documents` table
 * @param {Object} analysis  - Row from `analyses` table (JSON fields already parsed)
 * @param {Object} res       - Express res object
 */
function generateAnalysisPDF(docData, analysis, res) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 0, bottom: 40, left: 50, right: 50 },
    bufferPages: true,
  });

  const safeName = sanitizeFilename(docData.original_filename);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="LexSimple_${safeName}.pdf"`);
  doc.pipe(res);

  const W        = doc.page.width;  // A4 = 595.28 pt
  const LEFT     = 50;
  const RIGHT    = W - 50;
  const CONTENT_W = RIGHT - LEFT;   // 495.28 pt

  let y = 0;

  // ── 1. HEADER BAND ─────────────────────────────────────────────────────────
  doc.rect(0, 0, W, 72).fill(C.primary);

  doc.font('Helvetica-Bold').fontSize(22).fillColor(C.white);
  doc.text('LexSimple', LEFT, 18, { lineBreak: false });

  doc.font('Helvetica').fontSize(9).fillColor('#93c5fd');
  doc.text('Understand any legal document in plain English', LEFT, 44, { lineBreak: false });

  // Document-type badge — uses document_type field (fixed from old document_type mismatch)
  const docType = analysis.document_type || '';
  if (docType) {
    const badge  = docType.toUpperCase();
    const badgeW = Math.min(badge.length * 6.5 + 20, 180);
    doc.roundedRect(RIGHT - badgeW, 22, badgeW, 22, 4).fill(C.accent);
    doc.font('Helvetica-Bold').fontSize(7).fillColor(C.white);
    doc.text(badge, RIGHT - badgeW, 28, { width: badgeW, align: 'center', lineBreak: false });
  }

  y = 88;

  // ── 2. DOCUMENT INFO ROW ───────────────────────────────────────────────────
  const fname = docData.original_filename || 'Untitled Document';
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C.text);
  doc.text(fname, LEFT, y, { width: CONTENT_W * 0.65, lineBreak: false });

  const dateStr = new Date(analysis.created_at || Date.now()).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  doc.font('Helvetica').fontSize(9).fillColor(C.muted);
  doc.text(`Analyzed: ${dateStr}`, LEFT + CONTENT_W * 0.65, y + 2, {
    width: CONTENT_W * 0.35, align: 'right', lineBreak: false,
  });
  y += 16;

  if (analysis.ai_provider) {
    doc.font('Helvetica').fontSize(8).fillColor(C.muted);
    doc.text(`Powered by ${analysis.ai_provider}`, LEFT, y);
    y += 12;
  }

  y += 4;
  hRule(doc, y, LEFT, RIGHT, C.border);
  y += 16;

  // ── 3. SUMMARY ─────────────────────────────────────────────────────────────
  // Uses analysis.summary (fixed: was missing because old prompt returned overall_summary)
  if (analysis.summary) {
    y = drawSectionHeader(doc, 'Document Summary', y, LEFT, RIGHT);
    doc.font('Helvetica').fontSize(10).fillColor(C.text);
    doc.text(analysis.summary, LEFT, y, { width: CONTENT_W, align: 'justify' });
    y += doc.heightOfString(analysis.summary, { width: CONTENT_W }) + 18;
  }

  // ── 4. RISK OVERVIEW PILLS ─────────────────────────────────────────────────
  const sections = analysis.sections || [];

  if (sections.length > 0) {
    const high   = sections.filter(s => s.risk_level === 'high').length;
    const medium = sections.filter(s => s.risk_level === 'medium').length;
    const low    = sections.filter(s => s.risk_level === 'low').length;
    const neutral = sections.filter(s => s.risk_level === 'neutral').length;

    y = drawSectionHeader(doc, 'Risk Overview', y, LEFT, RIGHT);

    const pillW = (CONTENT_W - 36) / 4;
    const pills = [
      { label: 'HIGH RISK',   count: high,    color: C.high,   bg: C.highBg },
      { label: 'MEDIUM RISK', count: medium,  color: C.medium, bg: C.mediumBg },
      { label: 'LOW RISK',    count: low,     color: C.low,    bg: C.lowBg },
      { label: 'NEUTRAL',     count: neutral, color: C.neutral,bg: C.neutralBg },
    ];

    pills.forEach((p, i) => {
      const px = LEFT + i * (pillW + 12);
      doc.roundedRect(px, y, pillW, 52, 6).fill(p.bg);
      doc.font('Helvetica-Bold').fontSize(26).fillColor(p.color);
      doc.text(String(p.count), px, y + 6, { width: pillW, align: 'center', lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(7).fillColor(p.color);
      doc.text(p.label, px, y + 36, { width: pillW, align: 'center', lineBreak: false });
    });

    y += 68;
  }

  // ── 5. KEY DATES & AMOUNTS ─────────────────────────────────────────────────
  const dates   = analysis.key_dates   || [];
  const amounts = analysis.key_amounts || [];

  if (dates.length > 0 || amounts.length > 0) {
    if (y > 650) { doc.addPage(); y = 50; }
    y = drawSectionHeader(doc, 'Key Dates & Amounts', y, LEFT, RIGHT);

    const colW   = (CONTENT_W - 16) / 2;
    const startY = y;
    let   rightY = startY;

    // Left column: Dates
    if (dates.length > 0) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(C.muted);
      doc.text('KEY DATES', LEFT, y);
      y += 14;

      dates.slice(0, 8).forEach(d => {
        if (y > 720) { doc.addPage(); y = 50; }
        const label        = d.label  || '';
        const value        = d.value  || '';
        const partyAffected = d.party_affected || '';

        doc.font('Helvetica-Bold').fontSize(9).fillColor(C.text);
        doc.text(`• ${label}`, LEFT, y, { width: colW });
        y += doc.heightOfString(`• ${label}`, { width: colW }) + 2;

        if (value) {
          doc.font('Helvetica').fontSize(9).fillColor(C.accent);
          doc.text(value, LEFT + 8, y, { width: colW - 8 });
          y += doc.heightOfString(value, { width: colW - 8 }) + 2;
        }
        if (partyAffected) {
          doc.font('Helvetica').fontSize(8).fillColor(C.muted);
          doc.text(`Affects: ${partyAffected}`, LEFT + 8, y, { width: colW - 8 });
          y += doc.heightOfString(`Affects: ${partyAffected}`, { width: colW - 8 }) + 4;
        }
        y += 4;
      });
    }

    // Right column: Amounts
    if (amounts.length > 0) {
      const ax = LEFT + colW + 16;
      doc.font('Helvetica-Bold').fontSize(8).fillColor(C.muted);
      doc.text('KEY AMOUNTS', ax, startY);
      rightY = startY + 14;

      amounts.slice(0, 8).forEach(a => {
        const label        = a.label  || '';
        const value        = a.value  || '';
        const partyAffected = a.party_affected || '';

        doc.font('Helvetica-Bold').fontSize(9).fillColor(C.text);
        doc.text(`• ${label}`, ax, rightY, { width: colW });
        rightY += doc.heightOfString(`• ${label}`, { width: colW }) + 2;

        if (value) {
          doc.font('Helvetica').fontSize(9).fillColor(C.accent);
          doc.text(value, ax + 8, rightY, { width: colW - 8 });
          rightY += doc.heightOfString(value, { width: colW - 8 }) + 2;
        }
        if (partyAffected) {
          doc.font('Helvetica').fontSize(8).fillColor(C.muted);
          doc.text(`Affects: ${partyAffected}`, ax + 8, rightY, { width: colW - 8 });
          rightY += doc.heightOfString(`Affects: ${partyAffected}`, { width: colW - 8 }) + 4;
        }
        rightY += 4;
      });
    }

    y = Math.max(y, rightY) + 12;
  }

  // ── 6. HIGH RISK CLAUSES ───────────────────────────────────────────────────
  const highRisk = sections.filter(s => s.risk_level === 'high').slice(0, 5);

  if (highRisk.length > 0) {
    if (y > 640) { doc.addPage(); y = 50; }
    y = drawSectionHeader(doc, 'High Risk Clauses', y, LEFT, RIGHT);

    highRisk.forEach(s => {
      if (y > 700) { doc.addPage(); y = 50; }

      const snippet = truncate(s.plain_english || '', 160);
      // risk_reason only shown for high/medium — guaranteed by schema validator
      const reason  = s.risk_reason ? truncate(s.risk_reason, 120) : '';
      const rowH    = 28 + (snippet ? 14 : 0) + (reason ? 14 : 0);

      // Red left bar
      doc.rect(LEFT, y, 3, rowH).fill(C.high);

      // Section heading — uses s.heading (fixed from old s.title mismatch)
      doc.font('Helvetica-Bold').fontSize(10).fillColor(C.text);
      doc.text(s.heading || 'Clause', LEFT + 12, y + 5, {
        width: CONTENT_W - 75, lineBreak: false,
      });

      // Who benefits tag
      if (s.who_benefits) {
        doc.font('Helvetica').fontSize(8).fillColor(C.muted);
        doc.text(`Benefits: ${s.who_benefits}`, LEFT + 12, y + 18, {
          width: CONTENT_W - 75, lineBreak: false,
        });
      }

      // HIGH RISK badge
      doc.roundedRect(RIGHT - 56, y + 4, 56, 16, 3).fill(C.high);
      doc.font('Helvetica-Bold').fontSize(7).fillColor(C.white);
      doc.text('HIGH RISK', RIGHT - 56, y + 8, { width: 56, align: 'center', lineBreak: false });

      let innerY = y + 28;

      if (snippet) {
        doc.font('Helvetica').fontSize(9).fillColor(C.muted);
        doc.text(snippet, LEFT + 12, innerY, { width: CONTENT_W - 16 });
        innerY += doc.heightOfString(snippet, { width: CONTENT_W - 16 }) + 4;
      }

      // Risk reason — only present when risk_level is high or medium (enforced by schema validator)
      if (reason) {
        doc.font('Helvetica').fontSize(8).fillColor(C.high);
        doc.text(`⚠  ${reason}`, LEFT + 12, innerY, { width: CONTENT_W - 16 });
        innerY += doc.heightOfString(reason, { width: CONTENT_W - 16 }) + 4;
      }

      y = innerY + 8;
    });

    y += 4;
  }

  // ── 7. SECTION-BY-SECTION BREAKDOWN ───────────────────────────────────────
  if (sections.length > 0) {
    if (y > 600) { doc.addPage(); y = 50; }
    y = drawSectionHeader(doc, 'Section-by-Section Breakdown', y, LEFT, RIGHT);

    sections.forEach(s => {
      if (y > 700) { doc.addPage(); y = 50; }

      const riskKey    = (s.risk_level || 'neutral').toLowerCase();
      const riskCfg    = RISK_CONFIG[riskKey] || RISK_CONFIG.neutral;
      const plainText  = s.plain_english || '';
      const reason     = s.risk_reason || '';
      const showReason = reason && ['high', 'medium'].includes(riskKey);

      const textH = doc.heightOfString(plainText, { width: CONTENT_W - 20 });
      const reasonH = showReason
        ? doc.heightOfString(reason, { width: CONTENT_W - 20 }) + 6
        : 0;
      const rowH = 30 + textH + reasonH + 12;

      // Background card
      doc.roundedRect(LEFT, y, CONTENT_W, rowH, 5).fill(riskCfg.bg);

      // Left risk bar color
      doc.rect(LEFT, y, 3, rowH).fill(riskCfg.color);

      // Heading — uses s.heading
      doc.font('Helvetica-Bold').fontSize(10).fillColor(C.text);
      doc.text(s.heading || 'Section', LEFT + 12, y + 8, {
        width: CONTENT_W - 90, lineBreak: false,
      });

      // Risk badge — conditional label based on actual risk_level
      const badgeLabel = riskCfg.label;
      const badgeW     = badgeLabel.length * 5.5 + 14;
      doc.roundedRect(RIGHT - badgeW - 2, y + 6, badgeW, 16, 3).fill(riskCfg.color);
      doc.font('Helvetica-Bold').fontSize(7).fillColor(C.white);
      doc.text(badgeLabel, RIGHT - badgeW - 2, y + 10, {
        width: badgeW, align: 'center', lineBreak: false,
      });

      // Who benefits
      if (s.who_benefits) {
        doc.font('Helvetica').fontSize(8).fillColor(C.muted);
        doc.text(`Benefits: ${s.who_benefits}`, LEFT + 12, y + 20, {
          width: CONTENT_W - 90, lineBreak: false,
        });
      }

      // Plain English summary
      doc.font('Helvetica').fontSize(9).fillColor(C.text);
      doc.text(plainText, LEFT + 12, y + 30, { width: CONTENT_W - 20 });

      // Risk reason — ONLY rendered for high/medium (fixed: was shown for all sections)
      if (showReason) {
        const reasonY = y + 30 + textH + 6;
        doc.font('Helvetica').fontSize(8).fillColor(riskCfg.color);
        doc.text(`${riskCfg.icon}  ${reason}`, LEFT + 12, reasonY, { width: CONTENT_W - 20 });
      }

      y += rowH + 8;
    });

    y += 4;
  }

  // ── 8. MISSING CLAUSES ────────────────────────────────────────────────────
  const missing = analysis.missing_clauses || [];

  if (missing.length > 0) {
    if (y > 650) { doc.addPage(); y = 50; }
    y = drawSectionHeader(doc, 'Missing Clauses', y, LEFT, RIGHT);

    // Handles both string items (legacy) and {clause, why_it_matters} objects (current)
    missing.slice(0, 8).forEach(m => {
      if (y > 720) { doc.addPage(); y = 50; }

      const clauseName = typeof m === 'string' ? m : (m.clause || '');
      const whyMatters = typeof m === 'object' && m !== null ? (m.why_it_matters || '') : '';

      // Build display text: "Clause Name — Why it matters"
      const displayText = whyMatters
        ? `${clauseName} — ${whyMatters}`
        : clauseName;

      if (!displayText) return;

      const lineH = doc.heightOfString(displayText, { width: CONTENT_W - 24 });
      const rowH  = lineH + 16;

      doc.roundedRect(LEFT, y, CONTENT_W, rowH, 4).fill('#fffbeb');
      doc.rect(LEFT, y, 3, rowH).fill(C.medium);

      // Clause name bold
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#92400e');
      doc.text(`⚠  ${clauseName}`, LEFT + 12, y + 6, { width: CONTENT_W - 20, lineBreak: !whyMatters });

      if (whyMatters) {
        const clauseNameH = doc.heightOfString(`⚠  ${clauseName}`, { width: CONTENT_W - 20 });
        doc.font('Helvetica').fontSize(9).fillColor('#92400e');
        doc.text(whyMatters, LEFT + 12, y + 6 + clauseNameH + 2, { width: CONTENT_W - 20 });
      }

      y += rowH + 8;
    });
  }

  // ── 9. FOOTER (all pages) ─────────────────────────────────────────────────
  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    const pageBottom = doc.page.height - 30;
    hRule(doc, pageBottom - 10, LEFT, RIGHT, C.border, 0.5);
    doc.font('Helvetica').fontSize(8).fillColor(C.muted);
    doc.text(
      `Generated by LexSimple · Page ${i + 1} of ${totalPages} · This report is for informational purposes only and is not legal advice.`,
      LEFT, pageBottom,
      { width: CONTENT_W, align: 'center' }
    );
  }

  doc.end();
}

// ─── Drawing Helpers ──────────────────────────────────────────────────────────

/** Draws a labelled section header and returns the new Y after the underline. */
function drawSectionHeader(doc, title, y, left, right) {
  doc.font('Helvetica-Bold').fontSize(12).fillColor(C.primary);
  doc.text(title, left, y);
  y += 15;
  doc.moveTo(left, y).lineTo(right, y).strokeColor(C.lightBlue).lineWidth(1.5).stroke();
  return y + 10;
}

/** Draws a horizontal rule. */
function hRule(doc, y, left, right, color, width = 1) {
  doc.moveTo(left, y).lineTo(right, y).strokeColor(color).lineWidth(width).stroke();
}

/** Truncates a string with ellipsis. */
function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max).trimEnd() + '…' : str;
}

/** Makes a string safe for use in a filename. */
function sanitizeFilename(name) {
  if (!name) return 'Summary';
  return name
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60) || 'Summary';
}

export { generateAnalysisPDF };