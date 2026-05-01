import React, { useEffect, useState, useRef, useCallback } from "react";
import { apiClient, BACKEND_URL } from "../lib/api-client";
import { useToast } from "../lib/toast-context";
import { useSettings } from "../lib/settings-context";
import JSZip from "jszip";
import saveAs from "file-saver";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { ImageGalleryModal } from "./ImageGalleryModal";
import { PromptCollection } from "../lib/api-client";
import { useConfirm } from "../lib/confirm-context";

const API_ROOT = BACKEND_URL; // Use the standardized backend URL

// ── Browser Cache API helpers ──────────────────────────────────────────────
const GALLERY_CACHE_NAME = "gallery-images-v1";

/**
 * Removes stale entries from the browser Cache API.
 * Any cached image URL whose filename is not in the current gallery is deleted.
 * This keeps the cache clean when ComfyUI deletes an image.
 */
async function pruneGalleryCache(validFilenames: Set<string>): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const cache = await caches.open(GALLERY_CACHE_NAME);
    const keys = await cache.keys();
    for (const req of keys) {
      // Extract filename from URL path: /api/images/<filename>
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const fname = parts[parts.length - 1];
      if (fname && !validFilenames.has(fname)) {
        await cache.delete(req);
      }
    }
  } catch (e) {
    // Cache API not available or blocked — silently ignore
  }
}

export const Gallery: React.FC<{ onNavigate?: (tab: "studio" | "tasks" | "gallery" | "chat") => void }> = ({ onNavigate }) => {
  const { addToast } = useToast();
  const { confirm } = useConfirm();
  const { updateSettings } = useSettings();
  const [images, setImages] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(() => Number(localStorage.getItem("gallery_page_size")) || 24);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [showSavePromptModal, setShowSavePromptModal] = useState(false);
  const [promptToSave, setPromptToSave] = useState<any | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saveCollectionId, setSaveCollectionId] = useState<number | undefined>(undefined);
  const [availableCollections, setAvailableCollections] = useState<PromptCollection[]>([]);
  const [showSaveToCollectionModal, setShowSaveToCollectionModal] = useState(false);
  const [imagesToSave, setImagesToSave] = useState<any[]>([]);
  const [savingToCollection, setSavingToCollection] = useState(false);
  const [availableImageCollections, setAvailableImageCollections] = useState<any[]>([]);
  const [selectedImageCollectionId, setSelectedImageCollectionId] = useState<number | "">("");
  const [newCollectionName, setNewCollectionName] = useState("");

  // Tracks the last-known image filename fingerprint so polling only re-renders on real changes
  const prevFingerprintRef = useRef<string>("");
  const pendingNavRef = useRef<"prev" | "next" | null>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    const fetchGallery = async () => {
      try {
        const data = await apiClient.getGallery(page, pageSize);
        const incoming: any[] = data.images || [];

        // ── Smart diff: only update React state if the image list actually changed ──
        // Using filenames as a lightweight fingerprint avoids unnecessary re-renders
        // which would reset `isLoaded` on every ImageCard and cause the black-flash.
        const fingerprint = incoming.map((i: any) => i.filename).join(",");
        if (fingerprint !== prevFingerprintRef.current) {
          prevFingerprintRef.current = fingerprint;
          setImages(incoming);

          // Prune browser Cache API: remove entries for images no longer in the gallery
          const validNames = new Set<string>(incoming.map((i: any) => i.filename));
          pruneGalleryCache(validNames);
        }

        if (pendingNavRef.current === "prev" && incoming.length > 0) {
          setSelectedImage(incoming[incoming.length - 1]);
        } else if (pendingNavRef.current === "next" && incoming.length > 0) {
          setSelectedImage(incoming[0]);
        }
        pendingNavRef.current = null;

        if (data.total !== undefined) {
          setTotalPages(Math.ceil(data.total / pageSize) || 1);
        }
      } catch (err) {
        console.error("Gallery fetch error:", err);
      }
    };

    // Reset fingerprint when page/pageSize changes so we always render on navigation
    prevFingerprintRef.current = "";
    fetchGallery();
    // Only run live background refreshes when looking at the first page
    const interval = setInterval(() => {
      if (page === 1) fetchGallery();
    }, 5000);

    return () => clearInterval(interval);
  }, [page, pageSize]);

  const handlePrevImage = React.useCallback(() => {
    if (!selectedImage) return;
    const currentIndex = images.findIndex((img) => img.filename === selectedImage.filename);
    if (currentIndex === -1) return;

    if (currentIndex > 0) {
      setSelectedImage(images[currentIndex - 1]);
    } else if (page > 1) {
      pendingNavRef.current = "prev";
      setPage(page - 1);
    }
  }, [images, selectedImage, page]);

  const handleNextImage = React.useCallback(() => {
    if (!selectedImage) return;
    const currentIndex = images.findIndex((img) => img.filename === selectedImage.filename);
    if (currentIndex === -1) return;

    if (currentIndex < images.length - 1) {
      setSelectedImage(images[currentIndex + 1]);
    } else if (page < totalPages) {
      pendingNavRef.current = "next";
      setPage(page + 1);
    }
  }, [images, selectedImage, page, totalPages]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedImage(null);
      }
      
      if (!selectedImage) return;

      if (e.key === "ArrowLeft") {
        handlePrevImage();
      } else if (e.key === "ArrowRight") {
        handleNextImage();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedImage, handlePrevImage, handleNextImage]);

  const getImageUrl = useCallback((img: any) => {
    const path = img.url || img.file_path || "";
    if (!path) return "";
    const baseUrl = path.startsWith("http")
      ? path
      : `${API_ROOT}${path.startsWith("/") ? "" : "/"}${path}`;

    // Append only the auth token — no cache-buster timestamp.
    // Images have stable, unique filenames from ComfyUI so the browser's
    // built-in HTTP cache (+ Cache-Control: immutable from the server) handles
    // persistence across page reloads without ever re-fetching.
    const token = localStorage.getItem("token");
    const separator = baseUrl.includes("?") ? "&" : "?";
    return token ? `${baseUrl}${separator}token=${token}` : baseUrl;
  }, []);

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

  const handleOpenSavePrompt = async (img: any) => {
    setPromptToSave(img);
    setSaveName(`Prompt ${img.filename.substring(0, 8)}`);
    setShowSavePromptModal(true);
    try {
      const cols = await apiClient.getCollections();
      setAvailableCollections(cols);
    } catch (err) {
      console.error("Failed to fetch collections", err);
    }
  };

  const handleOpenSaveToCollection = async (imgs: any | any[]) => {
    const imagesArray = Array.isArray(imgs) ? imgs : [imgs];
    setImagesToSave(imagesArray);
    setShowSaveToCollectionModal(true);
    try {
      const cols = await apiClient.getImageCollections();
      setAvailableImageCollections(cols);
    } catch (err) {
      console.error("Failed to fetch image collections", err);
    }
  };

  const handleSaveToCollection = async () => {
    if (imagesToSave.length === 0) return;
    
    let collectionId = selectedImageCollectionId;
    setSavingToCollection(true);
    
    try {
      if (newCollectionName) {
        const newCol = await apiClient.createImageCollection(newCollectionName);
        collectionId = newCol.id;
        setNewCollectionName("");
      }
      
      if (collectionId === "") {
        addToast("Please select or create a collection.", "error");
        setSavingToCollection(false);
        return;
      }

      const payload = imagesToSave.map(img => ({
        filename: img.filename,
        subfolder: img.subfolder,
        type: img.type,
        positive_prompt: img.positive_prompt,
        negative_prompt: img.negative_prompt,
        width: img.width,
        height: img.height,
        steps: img.steps,
        seed: img.seed,
        workflow: img.workflow,
        collection_id: Number(collectionId)
      }));

      await apiClient.saveImagesToCollectionBulk(payload);
      
      addToast(`✨ ${imagesToSave.length > 1 ? `${imagesToSave.length} images` : "Image"} saved to collection!`, "success");
      setShowSaveToCollectionModal(false);
      setImagesToSave([]);
      if (selectionMode) {
        setSelectionMode(false);
        setSelectedImages(new Set());
      }
    } catch (err) {
      addToast("Failed to save to collection.", "error");
    } finally {
      setSavingToCollection(false);
    }
  };

  const handleSavePrompt = async () => {
    if (!promptToSave) return;
    try {
      await apiClient.createPrompt({
        name: saveName || "Unnamed Prompt",
        positive_prompt: promptToSave.positive_prompt,
        negative_prompt: promptToSave.negative_prompt,
        width: promptToSave.width,
        height: promptToSave.height,
        steps: promptToSave.steps,
        collection_id: saveCollectionId
      });
      addToast("✨ Prompt saved to Prompts Zone!", "success");
      setShowSavePromptModal(false);
      setPromptToSave(null);
    } catch (err) {
      addToast("Failed to save prompt.", "error");
    }
  };

  const handleBulkDownload = async (imagesToDownload: any[]) => {
    if (imagesToDownload.length === 0) return;
    setDownloading(true);
    try {
      const zip = new JSZip();
      for (const img of imagesToDownload) {
        const url = getImageUrl(img) + "&download=true";
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Fetch failed for ${url}`);
        const blob = await response.blob();
        zip.file(img.filename, blob);
      }
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `gallery-images-${Date.now()}.zip`);
      addToast(`Successfully downloaded ${imagesToDownload.length} images.`, "success");
      if (selectionMode) {
        setSelectionMode(false);
        setSelectedImages(new Set());
      }
    } catch (err) {
      console.error("Bulk download error:", err);
      addToast("Failed to download images. Check console.", "error");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadEverything = async () => {
    try {
      addToast("Fetching full gallery metadata...", "info");
      const allImages = await apiClient.getGalleryAll();
      if (!allImages || allImages.length === 0) {
        addToast("No images found to download.", "error");
        return;
      }
      addToast(`Starting ZIP of ${allImages.length} images...`, "info");
      await handleBulkDownload(allImages);
    } catch (err) {
      console.error("Full gallery download error:", err);
      addToast("Failed to fetch full gallery.", "error");
    }
  };

  const downloadSingleImage = async (img: any) => {
    try {
      const url = getImageUrl(img) + "&download=true";
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Fetch failed for ${url}`);
      const blob = await response.blob();
      saveAs(blob, img.filename);
      addToast("Image downloaded.", "success");
    } catch (err) {
      console.error("Single download error:", err);
      addToast("Failed to download image. Check console.", "error");
    }
  };

  const toggleSelection = (filename: string) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(filename)) {
      newSelected.delete(filename);
    } else {
      newSelected.add(filename);
    }
    setSelectedImages(newSelected);
  };

  const [showDetails, setShowDetails] = useState(window.innerWidth >= 1024);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between bg-zinc-900 border border-zinc-800 p-3 sm:p-4 rounded-xl gap-4 shadow-xl shadow-black/20">
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <button
            onClick={() => {
              setSelectionMode(!selectionMode);
              if (selectionMode) setSelectedImages(new Set());
            }}
            className={`flex-1 sm:flex-none text-[10px] sm:text-xs font-bold uppercase tracking-wider px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl transition-all border flex items-center justify-center gap-2 ${selectionMode ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20" : "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20"}`}
            title="Toggle selection mode"
          >
            {selectionMode ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLineJoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                <span className="hidden sm:inline">Cancel</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLineJoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><path d="M9 12l2 2 4-4"></path></svg>
                <span className="hidden sm:inline">Select Mode</span>
              </>
            )}
          </button>
          {selectionMode && (
             <div className="px-3 py-1.5 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
               <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">
                 {selectedImages.size} <span className="hidden xs:inline">Selected</span>
               </span>
             </div>
          )}
        </div>
        
        {/* Floating Download Buttons on Mobile / Toolbar on Desktop */}
        <div className="fixed bottom-6 right-6 lg:relative lg:bottom-auto lg:right-auto z-[60] flex flex-col-reverse lg:flex-row items-end lg:items-center gap-4 lg:gap-2 pointer-events-none">
          {selectionMode && selectedImages.size > 0 && (
             <div className="flex flex-col-reverse lg:flex-row items-end lg:items-center gap-4 lg:gap-2 pointer-events-none">
               <button
                 onClick={() => handleOpenSaveToCollection(images.filter(img => selectedImages.has(img.filename)))}
                 className="w-14 h-14 lg:w-auto lg:h-auto lg:flex-1 sm:lg:flex-none text-xs font-bold uppercase tracking-wider lg:px-5 lg:py-3 bg-zinc-800/90 lg:bg-zinc-800/80 border border-zinc-700/50 lg:border-zinc-700 hover:bg-zinc-700 hover:text-white text-zinc-400 rounded-full lg:rounded-xl transition-all flex items-center justify-center gap-2 shadow-2xl lg:shadow-none active:scale-95 pointer-events-auto backdrop-blur-xl"
                 title="Add selected to collection"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="lg:w-[14px] lg:h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLineJoin="round">
                   <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                   <line x1="12" y1="11" x2="12" y2="17"></line>
                   <line x1="9" y1="14" x2="15" y2="14"></line>
                 </svg>
                 <span className="hidden lg:inline">Add to Collection</span>
               </button>
               <button
                 onClick={() => handleBulkDownload(images.filter(img => selectedImages.has(img.filename)))}
                 disabled={downloading}
                 className="w-14 h-14 lg:w-auto lg:h-auto lg:flex-1 sm:lg:flex-none text-xs font-bold uppercase tracking-wider lg:px-5 lg:py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full lg:rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-2xl lg:shadow-lg shadow-indigo-500/40 lg:shadow-indigo-500/20 active:scale-95 pointer-events-auto backdrop-blur-xl border border-white/10 lg:border-none"
                 title="Download selected images"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="lg:w-[14px] lg:h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLineJoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                 <span className="hidden lg:inline">{downloading ? "Zipping..." : "Download Selected"}</span>
               </button>
             </div>
          )}
          {!selectionMode && images.length > 0 && (
             <div className="flex flex-col-reverse lg:flex-row items-end lg:items-center gap-4 lg:gap-2 pointer-events-none">
               <button
                 onClick={() => handleBulkDownload(images)}
                 disabled={downloading}
                 className="w-14 h-14 lg:w-auto lg:h-auto lg:flex-1 sm:lg:flex-none text-[9px] sm:lg:text-[10px] font-black uppercase tracking-[0.15em] lg:px-3 lg:py-2.5 sm:lg:px-4 sm:lg:py-3 bg-zinc-800/90 lg:bg-zinc-800/80 border border-zinc-700/50 lg:border-zinc-700 hover:bg-zinc-700 hover:text-white text-zinc-400 rounded-full lg:rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-2xl lg:shadow-none backdrop-blur-xl pointer-events-auto"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="lg:w-[14px] lg:h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLineJoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                 <span className="hidden lg:inline">{downloading ? "Zipping..." : "Zip Page"}</span>
               </button>
               <button
                 onClick={handleDownloadEverything}
                 disabled={downloading}
                 className="w-14 h-14 lg:w-auto lg:h-auto lg:flex-1 sm:lg:flex-none text-[9px] sm:lg:text-[10px] font-black uppercase tracking-[0.15em] lg:px-4 lg:py-2.5 sm:lg:px-5 sm:lg:py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full lg:rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-2xl lg:shadow-lg shadow-indigo-500/40 lg:shadow-indigo-500/25 active:scale-95 backdrop-blur-xl pointer-events-auto border border-white/10 lg:border-none"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="lg:w-[14px] lg:h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLineJoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                 <span className="hidden lg:inline">{downloading ? "Processing..." : "Download All"}</span>
               </button>
             </div>
          )}
        </div>
        
        {/* Desktop Page Size Selector */}
        <div className="hidden lg:flex items-center gap-2 bg-black/20 px-3 py-2 rounded-xl border border-zinc-800/50">
          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mr-1">Images</span>
          {[24, 48, 96].map(size => (
            <button
              key={size}
              onClick={() => {
                setPageSize(size);
                setPage(1);
                localStorage.setItem("gallery_page_size", String(size));
              }}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${pageSize === size ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"}`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Pagination (Top) */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center bg-zinc-900/50 border border-zinc-800/50 p-2 sm:p-3 rounded-xl gap-2">
          <div className="flex items-center gap-1.5">
            <button
              disabled={page === 1}
              onClick={() => setPage(1)}
              className="flex items-center justify-center w-9 h-9 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-20 disabled:cursor-not-allowed rounded-lg text-zinc-300 transition-all border border-zinc-700/50"
              title="First Page"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLineJoin="round"><polyline points="11 17 6 12 11 7"></polyline><polyline points="18 17 13 12 18 7"></polyline></svg>
            </button>
            <button
              disabled={page === 1}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-20 disabled:cursor-not-allowed rounded-lg text-zinc-300 transition-all border border-zinc-700/50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLineJoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
              <span className="hidden xs:inline">Prev</span>
            </button>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em]">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-1 mt-1">
               {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                 let pageNum = page;
                 if (page <= 3) pageNum = i + 1;
                 else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                 else pageNum = page - 2 + i;
                 
                 if (pageNum <= 0 || pageNum > totalPages) return null;

                 return (
                   <div key={pageNum} className={`w-1 h-1 rounded-full ${pageNum === page ? "bg-indigo-500" : "bg-zinc-800"}`}></div>
                 );
               })}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              disabled={page === totalPages}
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-20 disabled:cursor-not-allowed rounded-lg text-zinc-300 transition-all border border-zinc-700/50"
            >
              <span className="hidden xs:inline">Next</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLineJoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(totalPages)}
              className="flex items-center justify-center w-9 h-9 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-20 disabled:cursor-not-allowed rounded-lg text-zinc-300 transition-all border border-zinc-700/50"
              title="Last Page"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLineJoin="round"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>
            </button>
          </div>
        </div>
      )}

      {images.length === 0 ? (
        <div className="text-center text-zinc-500 py-12">
          No images found in gallery.
        </div>
      ) : (
        <MasonryGallery
          images={images}
          getImageUrl={getImageUrl}
          selectionMode={selectionMode}
          selectedImages={selectedImages}
          toggleSelection={toggleSelection}
          onImageClick={(img) => {
            if (selectionMode) {
              toggleSelection(img.filename);
            } else {
              setSelectedImage(img);
              setShowDetails(window.innerWidth >= 1024);
            }
          }}
        />
      )}


      {selectedImage && (
        <ImageGalleryModal
          selectedImage={selectedImage}
          images={images}
          getImageUrl={getImageUrl}
          onClose={() => setSelectedImage(null)}
          onPrev={handlePrevImage}
          onNext={handleNextImage}
          onRecreate={handleRecreate}
          onModify={handleModifyAndRecreate}
          onDownload={downloadSingleImage}
          onSavePrompt={handleOpenSavePrompt}
          onSaveToCollection={handleOpenSaveToCollection}
        />
      )}



      {/* Save Prompt Modal */}
      {showSavePromptModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-bold text-white mb-6">Save to Prompts Zone</h2>
            
            <div className="space-y-6 mb-10">
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-500 uppercase tracking-widest block">Prompt Name</label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="w-full bg-black/40 border border-zinc-800 rounded-2xl p-4 text-white placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-500 uppercase tracking-widest block">Collection (Optional)</label>
                <select
                  value={saveCollectionId || ""}
                  onChange={(e) => setSaveCollectionId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full bg-black/40 border border-zinc-800 rounded-2xl p-4 text-white focus:outline-none focus:border-indigo-500/50 transition-all appearance-none"
                >
                  <option value="">No Collection</option>
                  {availableCollections.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="bg-black/20 p-5 rounded-2xl border border-white/5">
                <span className="text-[10px] font-black text-white/30 uppercase tracking-widest block mb-2">Parameters to Save</span>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Resolution</span>
                    <span className="text-xs text-zinc-300 font-mono font-bold">{promptToSave?.width}×{promptToSave?.height}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Steps</span>
                    <span className="text-xs text-zinc-300 font-mono font-bold">{promptToSave?.steps}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowSavePromptModal(false)}
                className="flex-1 px-8 py-4 rounded-2xl text-zinc-400 font-bold hover:bg-zinc-800 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePrompt}
                className="flex-1 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-indigo-500/20 active:scale-95"
              >
                Save Prompt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save to Image Collection Modal */}
      {showSaveToCollectionModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-bold text-white mb-2">Save to Collections</h2>
            <p className="text-zinc-500 text-xs mb-6">
              {imagesToSave.length > 1 ? `Saving ${imagesToSave.length} images to your collection.` : "Saving image to your collection."}
            </p>
            
            <div className="space-y-6 mb-10">
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-500 uppercase tracking-widest block">Select Collection</label>
                <select
                  value={selectedImageCollectionId}
                  onChange={(e) => {
                    setSelectedImageCollectionId(e.target.value === "" ? "" : Number(e.target.value));
                    if (e.target.value !== "") setNewCollectionName("");
                  }}
                  className="w-full bg-black/40 border border-zinc-800 rounded-2xl p-4 text-white focus:outline-none focus:border-indigo-500/50 transition-all appearance-none"
                >
                  <option value="">-- Choose a collection --</option>
                  {availableImageCollections.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-zinc-800"></div>
                <span className="flex-shrink mx-4 text-zinc-600 text-[10px] font-black uppercase tracking-widest">OR</span>
                <div className="flex-grow border-t border-zinc-800"></div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-500 uppercase tracking-widest block">Create New Collection</label>
                <input
                  type="text"
                  placeholder="Collection name..."
                  value={newCollectionName}
                  onChange={(e) => {
                    setNewCollectionName(e.target.value);
                    if (e.target.value) setSelectedImageCollectionId("");
                  }}
                  className="w-full bg-black/40 border border-zinc-800 rounded-2xl p-4 text-white placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50 transition-all"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowSaveToCollectionModal(false)}
                className="flex-1 px-8 py-4 rounded-2xl text-zinc-400 font-bold hover:bg-zinc-800 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveToCollection}
                disabled={(!selectedImageCollectionId && !newCollectionName) || savingToCollection}
                className="flex-1 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-2xl font-bold transition-all shadow-xl shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-2"
              >
                {savingToCollection && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {savingToCollection ? "Saving..." : "Save to Collection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Justified Layout ────────────────────────────────────────────────────────

// ─── Masonry Layout ─────────────────────────────────────────────────────────

export const MasonryGallery: React.FC<{
  images: any[];
  getImageUrl: (img: any) => string;
  selectionMode: boolean;
  selectedImages: Set<string>;
  toggleSelection: (filename: string) => void;
  onImageClick: (img: any) => void;
}> = ({ images, getImageUrl, selectionMode, selectedImages, toggleSelection, onImageClick }) => {
  const [discoveredRatios, setDiscoveredRatios] = useState<Record<string, number>>({});
  const [numCols, setNumCols] = useState(window.innerWidth < 640 ? 2 : window.innerWidth < 1024 ? 3 : 4);

  useEffect(() => {
    const handleResize = () => {
      setNumCols(window.innerWidth < 640 ? 2 : window.innerWidth < 1024 ? 3 : 4);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setDiscoveredRatios({});
  }, [images.length, images[0]?.filename]);

  const handleDimensionsFound = (filename: string, ratio: number) => {
    setDiscoveredRatios(prev => {
      if (prev[filename] === ratio) return prev;
      return { ...prev, [filename]: ratio };
    });
  };

  // Distribute images into columns
  const columns = Array.from({ length: numCols }, () => [] as any[]);
  images.forEach((img, idx) => {
    columns[idx % numCols].push(img);
  });

  const gap = 12;

  return (
    <div className="flex" style={{ gap }}>      
      {columns.map((col, cIdx) => (
        <div key={cIdx} className="flex flex-col flex-1" style={{ gap }}>
          {col.map((img, iIdx) => {
            const cachedAR = discoveredRatios[img.filename];
            const ar = img.width && img.height ? img.width / img.height : (cachedAR || 1);
            return (
              <ImageCard
                key={img.filename}
                img={img}
                getImageUrl={getImageUrl}
                selectionMode={selectionMode}
                isSelected={selectedImages.has(img.filename)}
                onSelect={() => toggleSelection(img.filename)}
                onClick={() => onImageClick(img)}
                onDimensionsFound={handleDimensionsFound}
                aspectRatio={ar}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};

export const ImageCard = ({
  img,
  getImageUrl,
  onClick,
  selectionMode,
  isSelected,
  onSelect,
  onDimensionsFound,
  aspectRatio,
}: {
  img: any;
  getImageUrl: (img: any) => string;
  onClick: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onDimensionsFound?: (filename: string, ratio: number) => void;
  aspectRatio: number;
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const url = getImageUrl(img);

  // Only reset loaded state when the URL itself changes (not on every parent re-render)
  const prevUrlRef = useRef(url);
  if (prevUrlRef.current !== url) {
    prevUrlRef.current = url;
    // Reset via ref comparison instead of useEffect to avoid an extra render cycle
  }

  return (
    <div
      style={{ aspectRatio }}
      className={`relative group overflow-hidden rounded-xl bg-zinc-900 border cursor-pointer transition-all ${
        selectionMode && isSelected ? "border-indigo-500 ring-2 ring-indigo-500/50" : "border-zinc-800 hover:border-zinc-700"
      }`}
      onClick={onClick}
    >
      {selectionMode && (
        <div className="absolute top-2 right-2 z-10">
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
            isSelected ? "bg-indigo-500 border-indigo-500 text-white" : "border-white/50 bg-black/50"
          }`}>
            {isSelected && (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLineJoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
          </div>
        </div>
      )}
      {hasError ? (
        /* Broken-image placeholder shown when ComfyUI no longer has this file */
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-900 text-zinc-600 select-none">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLineJoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
            <line x1="2" y1="2" x2="22" y2="22"></line>
          </svg>
          <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">Unavailable</span>
        </div>
      ) : (
        <img
          src={url}
          alt={img.prompt || "Generated Image"}
          onLoad={(e) => {
            setIsLoaded(true);
            setHasError(false);
            if ((!img.width || !img.height) && onDimensionsFound) {
              const ratio = e.currentTarget.naturalWidth / e.currentTarget.naturalHeight;
              if (ratio && !isNaN(ratio)) {
                onDimensionsFound(img.filename, ratio);
              }
            }
          }}
          onError={() => {
            setHasError(true);
            setIsLoaded(false);
          }}
          className={`object-cover w-full h-full transition-all duration-700 ease-out ${
            isLoaded
              ? "opacity-100 blur-0 group-hover:scale-105"
              : "opacity-0 blur-md scale-105"
          }`}
        />
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors duration-300 flex items-end opacity-0 group-hover:opacity-100 p-4">
        <p className="text-[11px] text-zinc-200 line-clamp-3 leading-snug">
          {img.positive_prompt || img.filename}
        </p>
      </div>
    </div>
  );
};

