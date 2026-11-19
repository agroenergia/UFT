// Zero-dependency PDF 1.4 generator with WinAnsiEncoding & clickable URI annotations.
const WINANSI_MAP = {
  0x20AC: 128, 0x201A: 130, 0x0192: 131, 0x201E: 132, 0x2026: 133, 0x2020: 134, 0x2021: 135,
  0x02C6: 136, 0x2030: 137, 0x0160: 138, 0x2039: 139, 0x0152: 140, 0x017D: 142, 0x2018: 145,
  0x2019: 146, 0x201C: 147, 0x201D: 148, 0x2022: 149, 0x2013: 150, 0x2014: 151, 0x02DC: 152,
  0x2122: 153, 0x0161: 154, 0x203A: 155, 0x0153: 156, 0x017E: 158, 0x0178: 159
};

function toPdfAsciiEscaped(str) {
  let out = '';
  for (const ch of String(str || '')) {
    let code = ch.charCodeAt(0);
    if (code === 0x2713 || code === 0x2605 || code === 0x25D0 || code === 0x25CB) {
      out += '*';
      continue;
    }
    if (WINANSI_MAP[code]) code = WINANSI_MAP[code];
    if (code === 40 || code === 41 || code === 92) {
      out += '\\' + ch;
    } else if (code >= 32 && code <= 126) {
      out += ch;
    } else if (code >= 128 && code <= 255) {
      out += '\\' + code.toString(8).padStart(3, '0');
    } else {
      out += ' ';
    }
  }
  return out;
}

function wrapLine(text, maxChars = 84) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) {
      cur = w.length > maxChars ? w.slice(0, maxChars) : w;
    } else if ((cur + ' ' + w).length <= maxChars) {
      cur += ' ' + w;
    } else {
      lines.push(cur);
      cur = w.length > maxChars ? w.slice(0, maxChars) : w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function buildPdfBytes(items, headerTitle) {
  // Layout lines with optional clickable URLs per page (A4 595 x 842 pt)
  const pages = [];
  let curOps = [];
  let curAnnots = [];
  let y = 790;

  function startPage() {
    curOps = [];
    curAnnots = [];
    y = 790;
    // Header band
    curOps.push('0.06 0.21 0.33 rg 40 772 515 44 re f');
    curOps.push(`BT /F2 13 Tf 1 1 1 rg 52 796 Td (${toPdfAsciiEscaped(headerTitle)}) Tj ET`);
    curOps.push(
      `BT /F1 9 Tf 0.82 0.94 0.98 rg 52 781 Td (${toPdfAsciiEscaped('RigorAtlas PPGAD/UFT - Gerado em ' + new Date().toLocaleString('pt-BR'))}) Tj ET`
    );
    y = 750;
  }

  function ensureSpace(needPt) {
    if (y - needPt < 54) {
      pages.push({ ops: curOps.join('\n'), annots: curAnnots });
      startPage();
    }
  }

  function addLine(text, font = 'F1', size = 10, color = '0.1 0.16 0.22', indent = 46, linkUrl = '') {
    ensureSpace(size + 6);
    curOps.push(`BT /${font} ${size} Tf ${color} rg ${indent} ${y} Td (${toPdfAsciiEscaped(text)}) Tj ET`);
    if (linkUrl && /^https?:\/\//i.test(linkUrl)) {
      const approxW = Math.min(490, text.length * size * 0.52);
      curAnnots.push({
        rect: [indent, y - 3, indent + approxW, y + size + 1],
        url: linkUrl
      });
    }
    y -= size + 5;
  }

  startPage();

  items.forEach((pub, idx) => {
    ensureSpace(120);
    const numPrefix = items.length > 1 ? `${idx + 1}. ` : '';
    wrapLine(`${numPrefix}${pub.titulo}`, 76).forEach((ln, i) => {
      addLine(ln, 'F2', 11.5, '0.06 0.22 0.36', 46, i === 0 ? pub.doi : '');
    });
    if (pub.autores) {
      wrapLine(`Autores: ${pub.autores}`, 88).forEach(ln => addLine(ln, 'F1', 9.5, '0.25 0.34 0.4', 52));
    }
    wrapLine(`Periodico: ${pub.periodico}${pub.editora ? ' · ' + pub.editora : ''}`, 88).forEach(ln =>
      addLine(ln, 'F2', 9.5, '0.1 0.42 0.28', 52)
    );
    addLine(
      `Ano: ${pub.ano || 'A confirmar'} | ISSN: ${pub.issn || 'Nao informado'}${pub.citacoes ? ' | Citacoes: ' + pub.citacoes : ''}`,
      'F1',
      9.5,
      '0.22 0.28 0.34',
      52
    );
    wrapLine(`Situacao CAPES / Rede: ${pub.capes}`, 88).forEach(ln => addLine(ln, 'F1', 9.5, '0.08 0.32 0.22', 52));
    if (pub.doi) {
      wrapLine(`Link da publicacao (DOI): ${pub.doi}`, 88).forEach((ln, i) =>
        addLine(ln, 'F1', 9, '0.08 0.35 0.56', 52, i === 0 ? pub.doi : '')
      );
    }
    if (pub.journalUrl) {
      wrapLine(`Acesso online ao periodico: ${pub.journalUrl}`, 88).forEach((ln, i) =>
        addLine(ln, 'F1', 9, '0.08 0.35 0.56', 52, i === 0 ? pub.journalUrl : '')
      );
    }
    y -= 6;
    ensureSpace(12);
    curOps.push(`0.82 0.88 0.92 RG 46 ${y + 3} m 549 ${y + 3} l S`);
    y -= 10;
  });

  pages.push({ ops: curOps.join('\n'), annots: curAnnots });

  // Assemble PDF objects with exact byte offsets
  const objs = [];
  const addObj = body => {
    objs.push(body);
    return objs.length;
  };

  const catalogId = addObj(''); // placeholder 1
  const pagesId = addObj(''); // placeholder 2
  const f1Id = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const f2Id = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  const pageIds = [];
  for (const p of pages) {
    const contentId = addObj(`<< /Length ${p.ops.length} >>\nstream\n${p.ops}\nendstream`);
    const annotIds = [];
    for (const an of p.annots) {
      let safeUrl = String(an.url || '').trim();
      try { safeUrl = encodeURI(safeUrl); } catch {}
      safeUrl = safeUrl.replace(/[()\\]/g, m => '\\' + m);
      annotIds.push(
        addObj(
          `<< /Type /Annot /Subtype /Link /Rect [${an.rect.map(n => n.toFixed(1)).join(' ')}] /Border [0 0 0] /A << /S /URI /URI (${safeUrl}) >> >>`
        )
      );
    }
    const annotsStr = annotIds.length ? ` /Annots [${annotIds.map(id => `${id} 0 R`).join(' ')}]` : '';
    const pid = addObj(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${f1Id} 0 R /F2 ${f2Id} 0 R >> >> /Contents ${contentId} 0 R${annotsStr} >>`
    );
    pageIds.push(pid);
  }

  objs[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objs[pagesId - 1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] >>`;

  const chunks = ['%PDF-1.4\n'];
  const offsets = [0];
  let bytePos = chunks[0].length;
  for (let i = 0; i < objs.length; i++) {
    offsets.push(bytePos);
    const block = `${i + 1} 0 obj\n${objs[i]}\nendobj\n`;
    chunks.push(block);
    bytePos += block.length;
  }
  const xrefPos = bytePos;
  chunks.push(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i <= objs.length; i++) {
    chunks.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  chunks.push(`trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  const latinStr = chunks.join('');
  const bytes = new Uint8Array(latinStr.length);
  for (let i = 0; i < latinStr.length; i++) {
    bytes[i] = latinStr.charCodeAt(i) & 0xff;
  }
  return bytes;
}

export function downloadPublicationPdf(items, filename, headerTitle = 'Ficha de Publicacao Cientifica - RigorAtlas UFT') {
  const bytes = buildPdfBytes(items, headerTitle);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
