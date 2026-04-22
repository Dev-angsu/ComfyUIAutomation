import React, { useEffect, useState, useRef } from "react";

const API_ROOT = "http://localhost:8000"; // Assuming backend serves images at the root or /outputs route

export const Gallery: React.FC = () => {
  const [images, setImages] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 24; // Divisible by 2, 3, 4, and 6 for cleaner CSS grid rows

  // Cache busting tracking
  const seenUrls = useRef<Record<string, number>>({});
  const lastTotal = useRef<number>(0);

  useEffect(() => {
    const fetchGallery = async () => {
      try {
        // Using standard fetch explicitly to pass pagination parameters
        const response = await fetch(
          `${API_ROOT}/api/gallery?page=${page}&page_size=${pageSize}`,
        );
        if (!response.ok) throw new Error("Failed to fetch gallery");

        const data = await response.json();
        setImages(data.images || []);

        if (data.total !== undefined) {
          // Detect history reset to bust cache for overlapping filenames
          if (data.total < lastTotal.current) {
            seenUrls.current = {};
          }
          lastTotal.current = data.total;

          setTotalPages(Math.ceil(data.total / pageSize) || 1);
        }
      } catch (err) {
        console.error("Gallery fetch error:", err);
      }
    };

    fetchGallery();
    // Only run live background refreshes when looking at the first page
    const interval = setInterval(() => {
      if (page === 1) fetchGallery();
    }, 5000);

    return () => clearInterval(interval);
  }, [page]);

  const getImageUrl = (img: any) => {
    const path = img.url || img.file_path || "";
    if (!path) return "";
    const baseUrl = path.startsWith("http")
      ? path
      : `${API_ROOT}${path.startsWith("/") ? "" : "/"}${path}`;

    // Track first-seen timestamp to bust disk cache without causing infinite React render flickering
    if (!seenUrls.current[baseUrl]) {
      seenUrls.current[baseUrl] = Date.now();
    }
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}cb=${seenUrls.current[baseUrl]}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {images.length === 0 ? (
          <div className="col-span-full text-center text-zinc-500 py-12">
            No images found in gallery.
          </div>
        ) : (
          images.map((img, idx) => (
            <ImageCard
              key={idx}
              img={img}
              getImageUrl={getImageUrl}
              onClick={() => setSelectedImage(img)}
            />
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="p-3 border border-zinc-800 flex justify-between items-center bg-black/20 rounded-xl mt-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            className="text-xs px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-zinc-300 transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-zinc-500 font-medium">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
            className="text-xs px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-zinc-300 transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {selectedImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-5xl w-full max-h-full flex items-center justify-center">
            <img
              src={getImageUrl(selectedImage)}
              alt="Fullscreen view"
              onLoad={(e) => {
                e.currentTarget.classList.remove("opacity-0", "scale-95");
                e.currentTarget.classList.add("opacity-100", "scale-100");
              }}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl border border-white/10 opacity-0 scale-95 transition-all duration-500 ease-out"
            />
          </div>
        </div>
      )}
    </div>
  );
};

const ImageCard = ({
  img,
  getImageUrl,
  onClick,
}: {
  img: any;
  getImageUrl: (img: any) => string;
  onClick: () => void;
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const url = getImageUrl(img);

  // Reset loaded state if the image URL changes (e.g., during pagination)
  useEffect(() => {
    setIsLoaded(false);
  }, [url]);

  return (
    <div
      className="aspect-square relative group overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800 cursor-pointer"
      onClick={onClick}
    >
      <img
        src={url}
        alt={img.prompt || "Generated Image"}
        onLoad={() => setIsLoaded(true)}
        className={`object-cover w-full h-full transition-all duration-700 ease-out ${
          isLoaded
            ? "opacity-100 blur-0 group-hover:scale-105"
            : "opacity-0 blur-md scale-105"
        }`}
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors duration-300 flex items-end opacity-0 group-hover:opacity-100 p-3">
        <span className="text-xs text-white truncate">
          {img.prompt || "View Image"}
        </span>
      </div>
    </div>
  );
};
