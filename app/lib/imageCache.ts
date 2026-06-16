// Shared module-level cache — persists across client-side navigation within a tab
// Used by hair/page, style/page, and print/page so they all see the same data

export const hairImageCache: {
  photoKey: string | null;
  images: Record<string, string | null> | null;
} = { photoKey: null, images: null };

export const styleImageCache: {
  photoKey: string | null;
  images: Record<string, string | null> | null;
} = { photoKey: null, images: null };
