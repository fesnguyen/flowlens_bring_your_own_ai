import type { InspectionMaterials } from './context_builder';

import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS, MAX_PACKAGE_BYTES } from '../../../../shared/inspection_limits';

export type InspectionAttachment = { filename: string } & (
  | { status: 'included'; data: Uint8Array<ArrayBuffer> }
  | { status: 'excluded' | 'failed'; reason: string }
);

type AttachmentEntry = {
  originalName: string;
  packagedName?: string;
  status: InspectionAttachment['status'];
  reason?: string;
};

type ZipFile = { name: string; data: Uint8Array<ArrayBuffer> };

const encoder = new TextEncoder();

function safeName(filename: string): string {
  const normalized = filename.normalize('NFKC')
    .replace(/[<>:"/\\|?*\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g, '_')
    .replace(/\.{2,}/g, '_').trim();
  // Most filesystems limit names by bytes. Leave room for collision suffixes.
  const bounded = encoder.encode(normalized).subarray(0, 160);
  const name = new TextDecoder().decode(bounded).replace(/\ufffd$/, '').replace(/[. ]+$/, '');
  if (!name) return 'attachment';
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9]) *(?:\.|$)/i.test(name) ? `_${name}` : name;
}

function uniqueName(filename: string, used: Set<string>): string {
  const base = safeName(filename);
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const extension = dot > 0 ? base.slice(dot) : '';
  let candidate = base;
  for (let suffix = 2; used.has(candidate.toLowerCase()); suffix++) {
    candidate = `${stem}-${suffix}${extension}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function zipEntryBytes(file: ZipFile): number {
  return 76 + 2 * encoder.encode(file.name).byteLength + file.data.byteLength;
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
function zip(files: ZipFile[]): Blob {
  const chunks: BlobPart[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
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
  return new Blob([...chunks, ...central, end], { type: 'application/zip' });
}

/** Package authorized browser bytes and leave a manifest entry for every known attachment. */
export function buildInspectionPackage(
  materials: InspectionMaterials,
  attachments: InspectionAttachment[] = [],
  attachmentListingError?: string,
): { archive: Blob; skipped: number } {
  const files: ZipFile[] = [
    { name: 'instruction.md', data: encoder.encode(materials.instruction) },
    { name: 'issue.md', data: encoder.encode(materials.issue) },
    { name: 'flowlens.schema.json', data: encoder.encode(materials.schema) },
  ];
  const entries: AttachmentEntry[] = [];
  const included: AttachmentEntry[] = [];
  const used = new Set<string>();
  // Include headers and file names in the archive limit, starting with the end record.
  let total = files.reduce((sum, file) => sum + zipEntryBytes(file), 22);
  for (const attachment of attachments) {
    const entry: AttachmentEntry = { originalName: attachment.filename, status: attachment.status };
    entries.push(entry);
    if (attachment.status !== 'included') {
      entry.reason = attachment.reason;
      continue;
    }
    const name = uniqueName(attachment.filename, used);
    const file = { name: `attachments/${name}`, data: attachment.data };
    const bytes = zipEntryBytes(file);
    const reason = included.length >= MAX_ATTACHMENTS ? 'Attachment count limit exceeded'
      : attachment.data.byteLength > MAX_ATTACHMENT_BYTES ? 'Attachment exceeds the 3 MiB limit'
      : total + bytes > MAX_PACKAGE_BYTES ? 'Package size limit exceeded' : undefined;
    if (reason) {
      entry.status = 'excluded';
      entry.reason = reason;
      continue;
    }
    entry.packagedName = file.name;
    included.push(entry);
    files.push(file);
    total += bytes;
  }

  const metadata = {
    version: 1,
    issueKey: materials.issueKey,
    instructionVersion: 2,
    schemaId: (JSON.parse(materials.schema) as { $id?: string }).$id,
    createdAt: new Date().toISOString(),
    attachmentListingError,
    attachments: entries,
  };
  const manifest: ZipFile = { name: 'manifest.json', data: encoder.encode(JSON.stringify(metadata, null, 2)) };
  // If the manifest tips the archive over its budget, evict the last included attachment.
  while (total + zipEntryBytes(manifest) > MAX_PACKAGE_BYTES) {
    const entry = included.pop();
    if (!entry) throw new Error('The inspection documents exceed the ZIP size limit.');
    total -= zipEntryBytes(files.pop()!);
    delete entry.packagedName;
    entry.status = 'excluded';
    entry.reason = 'Package size limit exceeded';
    manifest.data = encoder.encode(JSON.stringify(metadata, null, 2));
  }
  files.push(manifest);
  return { archive: zip(files), skipped: entries.length - included.length };
}
