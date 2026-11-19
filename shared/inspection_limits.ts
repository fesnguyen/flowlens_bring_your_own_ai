// Leave room for base64 and the JSON envelope below Forge's 5 MB invoke response limit.
export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
export const MAX_PACKAGE_BYTES = 25 * 1024 * 1024;
export const MAX_ATTACHMENTS = 50;
