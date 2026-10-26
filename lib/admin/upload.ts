// Shared by the upload form (instant feedback) and the Server Action (the
// real check). Mirrors bit's own limits in humor-hello-world/lib/image-upload.ts.

export const IMAGE_BUCKET = "images";
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "png, jpeg, webp or gif only";
  if (file.size > MAX_IMAGE_BYTES) return "max 5 MB";
  return null;
}

// Same layout bit uses: <uploader id>/<uuid>.<ext>, so bit's own
// "upload into your own folder" storage policy covers it.
export function uploadPathFor(userId: string, file: File) {
  return `${userId}/${crypto.randomUUID()}.${EXTENSIONS[file.type] ?? "png"}`;
}

export function isOwnUploadPath(path: string, userId: string) {
  const [folder, name, ...rest] = path.split("/");
  return (
    rest.length === 0 &&
    folder === userId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|gif)$/.test(name ?? "")
  );
}
