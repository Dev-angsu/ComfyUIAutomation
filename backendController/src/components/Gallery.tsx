import React, { useEffect, useState, useRef } from "react";
import { apiClient } from "../lib/api-client";
import { useToast } from "../lib/toast-context";
import { useSettings } from "../lib/settings-context";

const API_ROOT = `http://${window.location.hostname}:8000`; // Dynamically use the correct host

export const Gallery: React.FC<{ onNavigate?: (tab: "studio" | "tasks" | "gallery" | "chat") => void }> = ({ onNavigate }) => {
  const { addToast } = useToast();
  const { updateSettings } = useSettings();
  const [images, setImages] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 24; // Divisible by 2, 3, 4, and 6 for cleaner CSS grid rows

  // Cache busting tracking
  const seenUrls = useRef<Record<string, number>>({});
  const lastTotal = useRef<number>(0);
  const pendingNavRef = useRef<"prev" | "next" | null>(null);

  useEffect(() => {
    const fetchGallery = async () => {
      try {
        // Using standard fetch explicitly to pass pagination parameters
        const response = await fetch(
          `${API_ROOT}/api/gallery?page=${page}&page_size=${pageSize}&cb=${Date.now()}`,
        );
        if (!response.ok) throw new Error("Failed to fetch gallery");

        const data = await response.json();
        setImages(data.images || []);

        if (pendingNavRef.current === "prev" && data.images?.length > 0) {
          setSelectedImage(data.images[data.images.length - 1]);
        } else if (pendingNavRef.current === "next" && data.images?.length > 0) {
          setSelectedImage(data.images[0]);
        }
        pendingNavRef.current = null;

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedImage(null);
      }
      
      if (!selectedImage) return;

      const currentIndex = images.findIndex((img) => img.filename === selectedImage.filename);
      if (currentIndex === -1) return;

      if (e.key === "ArrowLeft") {
        if (currentIndex > 0) {
          setSelectedImage(images[currentIndex - 1]);
        } else if (page > 1) {
          pendingNavRef.current = "prev";
          setPage(page - 1);
        }
      } else if (e.key === "ArrowRight") {
        if (currentIndex < images.length - 1) {
          setSelectedImage(images[currentIndex + 1]);
        } else if (page < totalPages) {
          pendingNavRef.current = "next";
          setPage(page + 1);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [images, selectedImage, page, totalPages]);

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

  const handleRecreate = async (img: any) => {
    try {
      await apiClient.generateSingle({
        positive_prompt: img.positive_prompt || "",
        negative_prompt: img.negative_prompt || "",
        params: {
          width: img.width,
          height: img.height,
          steps: img.steps,
          workflow: img.workflow,
        }
      });
      addToast("✨ Recreation enqueued! Check the Tasks or Studio tab.", "success");
    } catch (err) {
      console.error("Recreate error:", err);
      addToast("Failed to enqueue recreation job.", "error");
    }
  };

  const handleModifyAndRecreate = (img: any) => {
    updateSettings({
      positivePrompt: img.positive_prompt || "",
      negativePrompt: img.negative_prompt || "",
      width: img.width,
      height: img.height,
      steps: img.steps,
      workflow: img.workflow,
    });
    setSelectedImage(null);
    if (onNavigate) {
      onNavigate("studio");
    }
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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black animate-in fade-in duration-300"
          onClick={() => setSelectedImage(null)}
        >
          {/* Fullscreen Background Image */}
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
              <img
                src={getImageUrl(selectedImage)}
                alt="Fullscreen view"
                onLoad={(e) => {
                  e.currentTarget.classList.remove("opacity-0", "scale-95");
                  e.currentTarget.classList.add("opacity-100", "scale-100");
                }}
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl border border-white/10 opacity-0 scale-95 transition-all duration-500 ease-out pointer-events-none select-none"
              />
          </div>

          {/* Close Button */}
          <button 
            onClick={() => setSelectedImage(null)}
            className="absolute top-8 right-8 z-10 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all active:scale-90 shadow-2xl border border-white/10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLineJoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>

          {/* Overlaid UI Controls (Glassmorphism) Sidebar */}
          <div 
            className="absolute left-8 top-1/2 -translate-y-1/2 w-full max-w-sm px-4 flex flex-col gap-4 pointer-events-none"
          >
            <div 
              className="bg-zinc-950/20 backdrop-blur-2xl border border-white/5 rounded-[40px] p-10 shadow-2xl flex flex-col gap-8 animate-in slide-in-from-left-8 duration-700 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
                <div className="flex flex-col items-start gap-10">
                  <div className="w-full flex flex-col gap-6">
                    {selectedImage.positive_prompt && (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] opacity-90">Positive Prompt</span>
                          </div>
                          <CopyButton text={selectedImage.positive_prompt} />
                        </div>
                        <p className="text-sm text-white/90 leading-relaxed line-clamp-[12] font-mono font-medium">
                          {selectedImage.positive_prompt}
                        </p>
                      </div>
                    )}
                    {selectedImage.negative_prompt && (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                            <span className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em] opacity-90">Negative Prompt</span>
                          </div>
                          <CopyButton text={selectedImage.negative_prompt} />
                        </div>
                        <p className="text-xs text-white/50 leading-relaxed line-clamp-4 font-mono italic">
                          {selectedImage.negative_prompt}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-5 shrink-0 w-full">
                    <button
                      disabled={!selectedImage.positive_prompt}
                      onClick={() => handleRecreate(selectedImage)}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-8 py-4 rounded-[24px] font-bold text-sm transition-all flex items-center justify-center gap-3 shadow-2xl shadow-indigo-500/20 active:scale-95 group disabled:cursor-not-allowed"
                    >
                      <svg 
                        className="group-hover:rotate-180 transition-transform duration-500" 
                        xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLineJoin="round"
                      >
                        <path d="M21 2v6h-6"></path>
                        <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                        <path d="M3 22v-6h6"></path>
                        <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                      </svg>
                      {selectedImage.positive_prompt ? "Recreate Image" : "Metadata Missing"}
                    </button>

                    <button
                      disabled={!selectedImage.positive_prompt}
                      onClick={() => handleModifyAndRecreate(selectedImage)}
                      className="bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-8 py-4 rounded-[24px] font-bold text-sm transition-all flex items-center justify-center gap-3 active:scale-95 group disabled:cursor-not-allowed border border-zinc-700"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLineJoin="round"
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      {selectedImage.positive_prompt ? "Modify & Recreate" : "Metadata Missing"}
                    </button>
                    
                    <div className="grid grid-cols-1 gap-3 bg-white/5 p-5 rounded-[24px] border border-white/5">
                       <div className="flex items-center justify-between px-2">
                          <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Resolution</span>
                          <span className="text-xs text-white/80 font-mono font-bold">
                            {selectedImage.width ? `${selectedImage.width} × ${selectedImage.height}` : "N/A"}
                          </span>
                       </div>
                       <div className="flex items-center justify-between px-2 pt-3 border-t border-white/5">
                          <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Steps</span>
                          <span className="text-xs text-white/80 font-mono font-bold">
                            {selectedImage.steps || "N/A"}
                          </span>
                       </div>
                    </div>
                  </div>
               </div>
            </div>
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
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors duration-300 flex items-end opacity-0 group-hover:opacity-100 p-4">
        <p className="text-[11px] text-zinc-200 line-clamp-3 leading-snug">
          {img.positive_prompt || img.filename}
        </p>
      </div>
    </div>
  );
};

// Helper component for the copy button
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset icon after 2 seconds
  };

  return (
    <button
      onClick={handleCopy}
      className="text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1 z-10"
      title="Copy to clipboard"
    >
      {copied ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLineJoin="round"
          className="text-emerald-400"
        >
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLineJoin="round"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      )}
    </button>
  );
};
