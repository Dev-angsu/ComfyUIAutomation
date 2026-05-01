import React, { useEffect, useState, useCallback } from "react";
import { apiClient, ImageCollection, SavedImage, BACKEND_URL } from "../lib/api-client";
import { useToast } from "../lib/toast-context";
import { MasonryGallery, ImageCard } from "./Gallery";
import { ImageGalleryModal } from "./ImageGalleryModal";
import { useSettings } from "../lib/settings-context";
import { useConfirm } from "../lib/confirm-context";

const API_ROOT = BACKEND_URL;

export const Collections: React.FC<{ isActive?: boolean, onNavigate?: (tab: any) => void }> = ({ isActive, onNavigate }) => {
  const { addToast } = useToast();
  const { confirm } = useConfirm();
  const { updateSettings } = useSettings();
  const [collections, setCollections] = useState<ImageCollection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<number | null>(null);
  const [selectedImage, setSelectedImage] = useState<SavedImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<number>>(new Set());
  const [downloading, setDownloading] = useState(false);

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getImageCollections();
      setCollections(data);
    } catch (err) {
      console.error("Failed to fetch collections:", err);
      addToast("Failed to load collections.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (isActive) {
      fetchCollections();
    }
  }, [fetchCollections, isActive]);

  const activeCollection = collections.find(c => c.id === activeCollectionId);

  const getImageUrl = useCallback((img: any) => {
    const baseUrl = img.url || "";
    const token = localStorage.getItem("token");
    const separator = baseUrl.includes("?") ? "&" : "?";
    return token ? `${API_ROOT}${baseUrl}${separator}token=${token}` : `${API_ROOT}${baseUrl}`;
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
      addToast("✨ Recreation enqueued!", "success");
    } catch (err) {
      addToast("Failed to enqueue recreation.", "error");
    }
  };

  const handleModify = (img: any) => {
    updateSettings({
      positivePrompt: img.positive_prompt || "",
      negativePrompt: img.negative_prompt || "",
      width: img.width,
      height: img.height,
      steps: img.steps,
      workflow: img.workflow,
    });
    setSelectedImage(null);
    if (onNavigate) onNavigate("studio");
  };

  const handleDownload = async (img: any) => {
    try {
      const url = getImageUrl(img) + "&download=true";
      const response = await fetch(url);
      const blob = await response.blob();
      const urlBlob = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = urlBlob;
      a.download = img.filename;
      a.click();
      window.URL.revokeObjectURL(urlBlob);
    } catch (err) {
      addToast("Failed to download image.", "error");
    }
  };

  const handleToggleLike = async (img: SavedImage) => {
    try {
      const updated = await apiClient.updateSavedImage(img.id, { is_liked: !img.is_liked });
      setCollections(prev => prev.map(c => ({
        ...c,
        images: c.images.map(i => i.id === img.id ? updated : i).sort((a, b) => {
          if (a.is_liked === b.is_liked) return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          return a.is_liked ? -1 : 1;
        })
      })));
      if (selectedImage?.id === img.id) {
        setSelectedImage(updated);
      }
    } catch (err) {
      addToast("Failed to update like status.", "error");
    }
  };

  const handleDeleteImage = async (imgId: number) => {
    const isConfirmed = await confirm({
      title: "Remove Image",
      message: "Are you sure you want to remove this image from the collection?",
      variant: "danger",
      confirmText: "Remove"
    });
    if (!isConfirmed) return;
    
    try {
      await apiClient.deleteSavedImage(imgId);
      setCollections(prev => prev.map(c => ({
        ...c,
        images: c.images.filter(i => i.id !== imgId)
      })));
      setSelectedImage(null);
      addToast("Image removed from collection.", "success");
    } catch (err) {
      addToast("Failed to remove image.", "error");
    }
  };

  const handleDeleteCollection = async (id: number) => {
    const isConfirmed = await confirm({
      title: "Delete Collection",
      message: "This will permanently delete the collection and all its images. This action cannot be undone.",
      variant: "danger",
      confirmText: "Delete Permanently"
    });
    if (!isConfirmed) return;

    try {
      await apiClient.deleteImageCollection(id);
      setCollections(prev => prev.filter(c => c.id !== id));
      if (activeCollectionId === id) {
        setActiveCollectionId(collections.find(c => c.id !== id)?.id || null);
      }
      addToast("Collection deleted.", "success");
    } catch (err) {
      addToast("Failed to delete collection.", "error");
    }
  };

  const toggleSelection = (id: number) => {
    const next = new Set(selectedImageIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedImageIds(next);
  };

  const handleBulkDelete = async () => {
    if (selectedImageIds.size === 0) return;
    
    const isConfirmed = await confirm({
      title: `Remove ${selectedImageIds.size} Images`,
      message: `Are you sure you want to remove ${selectedImageIds.size} selected images from this collection? This will permanently delete the files.`,
      variant: "danger",
      confirmText: "Remove All"
    });
    if (!isConfirmed) return;

    try {
      await apiClient.deleteSavedImagesBulk(Array.from(selectedImageIds));
      setCollections(prev => prev.map(c => ({
        ...c,
        images: c.images.filter(img => !selectedImageIds.has(img.id))
      })));
      setSelectedImageIds(new Set());
      setSelectionMode(false);
      addToast(`Successfully removed ${selectedImageIds.size} images.`, "success");
    } catch (err) {
      addToast("Failed to remove selected images.", "error");
    }
  };

  const handleBulkDownload = async () => {
    if (selectedImageIds.size === 0 || !activeCollection) return;
    setDownloading(true);
    try {
      const JSZip = (await import("jszip")).default;
      const saveAs = (await import("file-saver")).saveAs;
      
      const zip = new JSZip();
      const imagesToDownload = activeCollection.images.filter(img => selectedImageIds.has(img.id));
      
      for (const img of imagesToDownload) {
        const url = getImageUrl(img) + "&download=true";
        const response = await fetch(url);
        const blob = await response.blob();
        zip.file(img.filename, blob);
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `${activeCollection.name}-${Date.now()}.zip`);
      addToast(`Downloaded ${imagesToDownload.length} images.`, "success");
    } catch (err) {
      console.error("Bulk download error:", err);
      addToast("Failed to download images.", "error");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Collections Sidebar-like Horizontal Scroller */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round" className="text-indigo-500"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                My Collections
            </h2>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => {
                        setSelectionMode(!selectionMode);
                        if (selectionMode) setSelectedImageIds(new Set());
                    }}
                    className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl transition-all border flex items-center justify-center gap-2 ${selectionMode ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20" : "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20"}`}
                >
                    {selectionMode ? "Cancel" : "Select Mode"}
                </button>
                <button 
                    onClick={() => setShowCreateModal(true)}
                    className="text-[10px] sm:text-xs font-bold uppercase tracking-widest px-4 py-2 sm:px-5 sm:py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-700 transition-all"
                >
                    + New
                </button>
            </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {collections.map(col => (
            <div
              key={col.id}
              onClick={() => setActiveCollectionId(prev => prev === col.id ? null : col.id)}
              className={`group relative px-5 py-3 rounded-xl border transition-all flex items-center gap-3 cursor-pointer ${
                activeCollectionId === col.id
                  ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-300 shadow-lg shadow-indigo-500/10"
                  : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
              }`}
            >
              <span className="font-bold text-sm">{col.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${activeCollectionId === col.id ? "bg-indigo-500/20" : "bg-zinc-800"}`}>
                {col.images.length}
              </span>
              
              {activeCollectionId === col.id && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteCollection(col.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all pointer-events-auto"
                    title="Delete Collection"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
              )}
            </div>
          ))}
        </div>

        {/* Bulk Action Toolbar */}
        {selectionMode && activeCollection && activeCollection.images.length > 0 && (
            <div className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800 p-3 rounded-2xl animate-in slide-in-from-top-4 duration-300">
                <div className="flex items-center gap-3">
                    <div className="px-3 py-1.5 bg-zinc-800 rounded-lg border border-zinc-700">
                        <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">
                            {selectedImageIds.size} Selected
                        </span>
                    </div>
                    {selectedImageIds.size > 0 && (
                        <button
                            onClick={() => {
                                const allIds = activeCollection.images.map(img => img.id);
                                if (selectedImageIds.size === allIds.length) setSelectedImageIds(new Set());
                                else setSelectedImageIds(new Set(allIds));
                            }}
                            className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 uppercase tracking-widest transition-colors"
                        >
                            {selectedImageIds.size === activeCollection.images.length ? "Deselect All" : "Select All"}
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        disabled={selectedImageIds.size === 0 || downloading}
                        onClick={handleBulkDownload}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLineJoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        {downloading ? "Zipping..." : "Download"}
                    </button>
                    <button
                        disabled={selectedImageIds.size === 0}
                        onClick={handleBulkDelete}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLineJoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        Remove
                    </button>
                </div>
            </div>
        )}
      </div>

      {/* Images Grid */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-zinc-800 border-t-indigo-500 rounded-full animate-spin"></div>
          </div>
        ) : activeCollection ? (
          activeCollection.images.length > 0 ? (
            <MasonryGallery
              images={activeCollection.images}
              getImageUrl={getImageUrl}
              selectionMode={selectionMode}
              selectedImages={new Set(Array.from(selectedImageIds).map(id => {
                const img = activeCollection.images.find(i => i.id === id);
                return img ? img.filename : "";
              }))}
              toggleSelection={(filename) => {
                const img = activeCollection.images.find(i => i.filename === filename);
                if (img) toggleSelection(img.id);
              }}
              onImageClick={(img) => {
                if (selectionMode) {
                  toggleSelection(img.id);
                } else {
                  setSelectedImage(img);
                }
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 bg-zinc-900/30 border border-zinc-800 border-dashed rounded-3xl text-zinc-600 gap-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLineJoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
              <p className="text-sm font-medium">This collection is empty.</p>
              <button 
                onClick={() => onNavigate && onNavigate("gallery")}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 underline"
              >
                Browse Gallery to add images
              </button>
            </div>
          )
        ) : (
          <div className="text-center text-zinc-500 py-12">
            Select a collection to view images.
          </div>
        )}
      </div>

      {selectedImage && (
        <ImageGalleryModal
          selectedImage={selectedImage}
          images={activeCollection?.images || []}
          getImageUrl={getImageUrl}
          onClose={() => setSelectedImage(null)}
          onPrev={() => {
            const idx = activeCollection!.images.findIndex(i => i.id === selectedImage.id);
            if (idx > 0) setSelectedImage(activeCollection!.images[idx - 1]);
          }}
          onNext={() => {
            const idx = activeCollection!.images.findIndex(i => i.id === selectedImage.id);
            if (idx < activeCollection!.images.length - 1) setSelectedImage(activeCollection!.images[idx + 1]);
          }}
          onRecreate={handleRecreate}
          onModify={handleModify}
          onDownload={handleDownload}
          onToggleLike={handleToggleLike}
          onDelete={handleDeleteImage}
          isCollectionMode={true}
        />
      )}

      {/* Create Collection Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-bold text-white mb-6">New Collection</h2>
            
            <div className="space-y-4 mb-8">
              <label className="text-xs font-black text-zinc-500 uppercase tracking-widest block">Collection Name</label>
              <input
                autoFocus
                type="text"
                placeholder="Enter name..."
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && newColName.trim()) {
                        apiClient.createImageCollection(newColName).then(() => {
                            fetchCollections();
                            setShowCreateModal(false);
                            setNewColName("");
                        });
                    }
                }}
                className="w-full bg-black/40 border border-zinc-800 rounded-2xl p-4 text-white placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50 transition-all"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => { setShowCreateModal(false); setNewColName(""); }}
                className="flex-1 px-6 py-4 rounded-2xl text-zinc-400 font-bold hover:bg-zinc-800 transition-all"
              >
                Cancel
              </button>
              <button
                disabled={!newColName.trim()}
                onClick={() => {
                    apiClient.createImageCollection(newColName).then(() => {
                        fetchCollections();
                        setShowCreateModal(false);
                        setNewColName("");
                    });
                }}
                className="flex-1 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-2xl font-bold transition-all shadow-xl shadow-indigo-500/20 active:scale-95"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
