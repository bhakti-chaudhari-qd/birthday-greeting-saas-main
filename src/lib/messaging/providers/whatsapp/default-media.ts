/**
 * Minimal JPEG used when the CustomAPI WhatsApp endpoint requires a file.
 * Embedded as base64 so Next.js/serverless runtimes do not depend on packing
 * a sidecar binary next to the compiled module.
 */
const DEFAULT_WHATSAPP_MEDIA_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUSEhIVFhUVFRUVFRUVFRUWFxUXFhUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAAFBgAEBwIDAf/EADkQAAIBAwMCBAMFBgcBAAAAAAECAwAEEQUSITFBBhNRYQcicYGRFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7a3u7y8wcHCw8PDxcvLz8/P0NPTw8fT19fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==";

let cachedDefaultMedia: Buffer | null = null;

export function getDefaultWhatsAppMediaJpeg(): Buffer {
  if (!cachedDefaultMedia) {
    cachedDefaultMedia = Buffer.from(DEFAULT_WHATSAPP_MEDIA_JPEG_BASE64, "base64");
  }

  return cachedDefaultMedia;
}

export const DEFAULT_WHATSAPP_MEDIA_FILENAME = "whatsapp-media.jpg";
export const DEFAULT_WHATSAPP_MEDIA_CONTENT_TYPE = "image/jpeg";
