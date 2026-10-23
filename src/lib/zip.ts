import "server-only";

import { crc32 } from "node:zlib";

// Minimal streaming ZIP writer (STORE: no compression; logos are already compressed PNG/JPG/WebP).
// Each file is written as it arrives, so the archive streams instead of being held in memory.

export type ZipEntry = { name: string; data: Uint8Array };

function dosDateTime(d: Date) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

/** A ReadableStream of a .zip built from `entries` (an async iterable, so files can be fetched one by one). */
export function zipStream(entries: AsyncIterable<ZipEntry>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const central: Uint8Array[] = [];
  let offset = 0;
  let count = 0;
  const { time, date } = dosDateTime(new Date());

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const entry of entries) {
          const name = encoder.encode(entry.name);
          const crc = crc32(entry.data) >>> 0;
          const size = entry.data.length;

          const local = new DataView(new ArrayBuffer(30));
          local.setUint32(0, 0x04034b50, true); // local file header
          local.setUint16(4, 20, true); // version needed
          local.setUint16(6, 0x0800, true); // UTF-8 names
          local.setUint16(8, 0, true); // STORE
          local.setUint16(10, time, true);
          local.setUint16(12, date, true);
          local.setUint32(14, crc, true);
          local.setUint32(18, size, true);
          local.setUint32(22, size, true);
          local.setUint16(26, name.length, true);
          local.setUint16(28, 0, true);
          controller.enqueue(new Uint8Array(local.buffer));
          controller.enqueue(name);
          controller.enqueue(entry.data);

          const dir = new DataView(new ArrayBuffer(46));
          dir.setUint32(0, 0x02014b50, true); // central directory header
          dir.setUint16(4, 20, true);
          dir.setUint16(6, 20, true);
          dir.setUint16(8, 0x0800, true);
          dir.setUint16(10, 0, true);
          dir.setUint16(12, time, true);
          dir.setUint16(14, date, true);
          dir.setUint32(16, crc, true);
          dir.setUint32(20, size, true);
          dir.setUint32(24, size, true);
          dir.setUint16(28, name.length, true);
          dir.setUint32(42, offset, true); // local header offset
          central.push(new Uint8Array(dir.buffer), name);

          offset += 30 + name.length + size;
          count++;
        }

        const dirSize = central.reduce((n, c) => n + c.length, 0);
        for (const c of central) controller.enqueue(c);
        const end = new DataView(new ArrayBuffer(22));
        end.setUint32(0, 0x06054b50, true); // end of central directory
        end.setUint16(8, count, true);
        end.setUint16(10, count, true);
        end.setUint32(12, dirSize, true);
        end.setUint32(16, offset, true);
        controller.enqueue(new Uint8Array(end.buffer));
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });
}
