import type { InspectionMaterials } from './context_builder';

export type InspectionAttachment = {
  filename: string;
  data?: Uint8Array;
  reason?: string;
};

const encoder = new TextEncoder();
const MAX_PACKAGE_BYTES = 25 * 1024 * 1024;
const MAX_ATTACHMENTS = 50;

function safeName(filename: string): string {
  const name = filename.replace(/[\\/\x00-\x1f\x7f]/g, '_').replace(/\.\./g, '_').trim();
  return name && name !== '.' ? name.slice(0, 160) : 'attachment';
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function write16(view: DataView, offset: number, n: number): void { view.setUint16(offset, n, true); }
function write32(view: DataView, offset: number, n: number): void { view.setUint32(offset, n, true); }

/**
 * Minimal ZIP writer (STORE method, UTF-8 filenames). No compression or
 * Node-only dependency, so it works in the Forge Custom UI browser.
 */
function zip(files: { name: string; data: Uint8Array }[]): Blob {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const checksum = crc32(file.data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    write32(lv, 0, 0x04034b50); write16(lv, 4, 20);
    write16(lv, 6, 0x0800); write32(lv, 14, checksum);
    write32(lv, 18, file.data.length); write32(lv, 22, file.data.length);
    write16(lv, 26, name.length); local.set(name, 30);
    chunks.push(local, file.data);

    const directory = new Uint8Array(46 + name.length);
    const dv = new DataView(directory.buffer);
    write32(dv, 0, 0x02014b50); write16(dv, 4, 20); write16(dv, 6, 20);
    write16(dv, 8, 0x0800); write32(dv, 16, checksum);
    write32(dv, 20, file.data.length); write32(dv, 24, file.data.length);
    write16(dv, 28, name.length); write32(dv, 42, offset);
    directory.set(name, 46); central.push(directory);
    offset += local.length + file.data.length;
  }
  const directorySize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  write32(ev, 0, 0x06054b50);
  write16(ev, 8, files.length); write16(ev, 10, files.length);
  write32(ev, 12, directorySize); write32(ev, 16, offset);
  return new Blob([...chunks, ...central, end].map(part => new Uint8Array(part)), { type: 'application/zip' });
}

/**
 * Accepts already-authorized attachment bytes; Jira fetching belongs to the
 * resolver, not to this pure package assembler. Skipped files are manifested.
 */
export function buildInspectionPackage(
  materials: InspectionMaterials,
  attachments: InspectionAttachment[] = [],
): Blob {
  const files = [
    { name: 'instruction.md', data: encoder.encode(materials.instruction) },
    { name: 'issue.md', data: encoder.encode(materials.issue) },
    { name: 'flowlens.schema.json', data: encoder.encode(materials.schema) },
  ];
  const entries: { originalName: string; packagedName?: string; status: string; reason?: string }[] = [];
  const used = new Set<string>();
  let total = files.reduce((sum, file) => sum + file.data.length, 0);
  for (const [index, attachment] of attachments.entries()) {
    const base = safeName(attachment.filename);
    let filename = base;
    for (let suffix = 1; used.has(filename.toLowerCase()); suffix++) filename = `${suffix}-${base}`;
    used.add(filename.toLowerCase());
    const data = attachment.data;
    const reason = index >= MAX_ATTACHMENTS ? 'Attachment count limit exceeded'
      : !data ? (attachment.reason || 'Attachment unavailable')
      : total + data.length > MAX_PACKAGE_BYTES ? 'Package size limit exceeded' : undefined;
    if (reason) {
      entries.push({ originalName: attachment.filename, status: 'excluded', reason });
    } else if (data) {
      files.push({ name: `attachments/${filename}`, data });
      total += data.length;
      entries.push({ originalName: attachment.filename, packagedName: filename, status: 'included' });
    }
  }
  const manifest = encoder.encode(JSON.stringify({ version: 1, attachments: entries }, null, 2));
  if (total + manifest.length > MAX_PACKAGE_BYTES) throw new Error('Inspection package exceeds size limit.');
  files.push({ name: 'manifest.json', data: manifest });
  return zip(files);
}
