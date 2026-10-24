import "server-only";

// A one-page PDF around a JPEG (DCTDecode), sized to A4 landscape. Enough for a certificate; no dependency.
export function jpegToPdf(jpeg: Buffer, width: number, height: number, title: string): Buffer {
  const pageW = 842;
  const pageH = Math.round((pageW * height) / width);
  const parts: Buffer[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (chunk: string | Buffer) => {
    const b = typeof chunk === "string" ? Buffer.from(chunk, "latin1") : chunk;
    parts.push(b);
    length += b.length;
  };
  const obj = (n: number, body: string | Buffer[]) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
    if (typeof body === "string") push(body);
    else body.forEach(push);
    push("\nendobj\n");
  };
  const safeTitle = title.replace(/[()\\]/g, "").replace(/[^\x20-\x7e]/g, "-");
  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`;

  push("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  obj(4, [
    Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, "latin1"),
    jpeg,
    Buffer.from("\nendstream", "latin1"),
  ]);
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  obj(6, `<< /Title (${safeTitle}) /Producer (Matiks College League) >>`);
  const xref = length;
  push(`xref\n0 7\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`);
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return Buffer.concat(parts);
}
