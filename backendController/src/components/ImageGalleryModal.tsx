import React, { useRef, useState, useEffect } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

interface ImageGalleryModalProps {
  selectedImage: any;
  images: any[];
  getImageUrl: (img: any) => string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onRecreate: (img: any) => void;
  onModify: (img: any) => void;
  onDownload: (img: any) => void;
  onSavePrompt?: (img: any) => void;
  onSaveToCollection?: (img: any) => void;
  onToggleLike?: (img: any) => void;
  onDelete?: (imgId: number) => void;
  isCollectionMode?: boolean;
}

export const ImageGalleryModal: React.FC<ImageGalleryModalProps> = ({
  selectedImage,
  images,
  getImageUrl,
  onClose,
  onPrev,
  onNext,
  onRecreate,
  onModify,
  onDownload,
  onSavePrompt,
  onSaveToCollection,
  onToggleLike,
  onDelete,
  isCollectionMode = false
}) => {
  const [showDetails, setShowDetails] = useState(window.innerWidth >= 1024);
  const isDragging = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onPrev, onNext]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black animate-in fade-in duration-300"
      onClick={() => {
        if (!isDragging.current) {
          onClose();
        }
      }}
    >
      {/* Fullscreen Background Image */}
      <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 overflow-hidden">
        <TransformWrapper 
          initialScale={1} 
          minScale={0.5} 
          maxScale={5} 
          centerOnInit={true} 
          limitToBounds={false}
          onPanningStart={() => { isDragging.current = true; }}
          onPanningStop={() => { setTimeout(() => { isDragging.current = false; }, 100); }}
          onZoomStart={() => { isDragging.current = true; }}
          onZoomStop={() => { setTimeout(() => { isDragging.current = false; }, 100); }}
        >
          <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img
              src={getImageUrl(selectedImage)}
              alt="Fullscreen view"
              onLoad={(e) => {
                e.currentTarget.classList.remove("opacity-0", "scale-95");
                e.currentTarget.classList.add("opacity-100", "scale-100");
              }}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl border border-white/10 opacity-0 scale-95 transition-all duration-500 ease-out select-none"
              onClick={(e) => e.stopPropagation()}
            />
          </TransformComponent>
        </TransformWrapper>
      </div>

      {/* Top Controls (Close & Toggle Info) */}
      <div className="absolute top-4 sm:top-8 right-4 sm:right-8 flex items-center gap-3 z-10">
        {onToggleLike && isCollectionMode && (
          <button 
            onClick={(e) => { e.stopPropagation(); onToggleLike(selectedImage); }}
            className={`p-3 backdrop-blur-md rounded-full text-white transition-all active:scale-90 shadow-2xl border border-white/10 ${selectedImage.is_liked ? "bg-pink-600/50 text-pink-200" : "bg-white/10 hover:bg-white/20"}`}
            title={selectedImage.is_liked ? "Unlike Image" : "Like Image"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={selectedImage.is_liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLineJoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.84-8.84 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </button>
        )}
        <button 
          onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}
          className={`p-3 backdrop-blur-md rounded-full text-white transition-all active:scale-90 shadow-2xl border border-white/10 ${showDetails ? "bg-indigo-600/50 hover:bg-indigo-600/70" : "bg-white/10 hover:bg-white/20"}`}
          title={showDetails ? "Hide Prompt Details" : "Show Prompt Details"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLineJoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        </button>
        <button 
          onClick={onClose}
          className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all active:scale-90 shadow-2xl border border-white/10"
          title="Close Gallery (Esc)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLineJoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      {/* Navigation Controls (Bottom Center) */}
      <div className="absolute bottom-8 sm:bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4 sm:gap-6 z-10 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onPrev}
          className="p-3.5 sm:p-4 bg-white/5 hover:bg-white/10 backdrop-blur-xl rounded-2xl text-white transition-all active:scale-95 border border-white/10 group shadow-2xl"
          title="Previous Image (Left Arrow)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLineJoin="round" className="group-hover:-translate-x-1 transition-transform sm:w-6 sm:h-6"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        
        <div className="px-4 py-2 sm:px-6 sm:py-3 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 text-white/50 text-[10px] sm:text-xs font-bold tracking-widest uppercase">
          {images.findIndex(img => img.id === selectedImage.id || img.filename === selectedImage.filename) + 1} / {images.length}
        </div>

        <button
          onClick={onNext}
          className="p-3.5 sm:p-4 bg-white/5 hover:bg-white/10 backdrop-blur-xl rounded-2xl text-white transition-all active:scale-95 border border-white/10 group shadow-2xl"
          title="Next Image (Right Arrow)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLineJoin="round" className="group-hover:translate-x-1 transition-transform sm:w-6 sm:h-6"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>

      {/* Overlaid UI Controls (Glassmorphism) Sidebar / Bottom Sheet */}
      <div 
        className={`
          absolute transition-all duration-500 ease-in-out pointer-events-none z-20
          ${showDetails ? "opacity-100 translate-y-0 lg:translate-x-0" : "opacity-0 translate-y-8 lg:-translate-x-8 pointer-events-none"}
          bottom-24 left-4 right-4 sm:left-8 sm:right-8 lg:right-auto lg:top-1/2 lg:-translate-y-1/2 lg:bottom-auto lg:w-full lg:max-w-sm
        `}
      >
        <div 
          className={`bg-zinc-950/40 backdrop-blur-3xl border border-white/10 rounded-[32px] lg:rounded-[40px] p-6 sm:p-8 lg:p-10 shadow-2xl flex flex-col gap-6 lg:gap-8 ${showDetails ? "pointer-events-auto" : "pointer-events-none"} max-h-[60vh] lg:max-h-none overflow-y-auto no-scrollbar`}
          onClick={(e) => e.stopPropagation()}
        >
            <div className="flex flex-col items-start gap-6 lg:gap-10">
              <div className="w-full flex flex-col gap-5 lg:gap-6">
                {selectedImage.positive_prompt && (
                  <div className="flex flex-col gap-2 sm:gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                        <span className="text-[9px] sm:text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] opacity-90">Positive Prompt</span>
                      </div>
                      <CopyButton text={selectedImage.positive_prompt} />
                    </div>
                    <p className="text-xs sm:text-sm text-white/90 leading-relaxed line-clamp-[6] lg:line-clamp-[12] font-mono font-medium">
                      {selectedImage.positive_prompt}
                    </p>
                  </div>
                )}
                {selectedImage.negative_prompt && (
                  <div className="flex flex-col gap-2 sm:gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                        <span className="text-[9px] sm:text-[10px] font-black text-red-400 uppercase tracking-[0.2em] opacity-90">Negative Prompt</span>
                      </div>
                      <CopyButton text={selectedImage.negative_prompt} />
                    </div>
                    <p className="text-[10px] sm:text-xs text-white/50 leading-relaxed line-clamp-3 lg:line-clamp-4 font-mono italic">
                      {selectedImage.negative_prompt}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:gap-4 lg:gap-5 shrink-0 w-full">
                <button
                  disabled={!selectedImage.positive_prompt}
                  onClick={() => onRecreate(selectedImage)}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-6 py-3.5 sm:px-8 sm:py-4 rounded-[20px] lg:rounded-[24px] font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-3 shadow-2xl shadow-indigo-500/20 active:scale-95 group disabled:cursor-not-allowed"
                >
                  <svg 
                    className="group-hover:rotate-180 transition-transform duration-500 w-4 h-4 sm:w-5 sm:h-5" 
                    xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLineJoin="round"
                  >
                    <path d="M21 2v6h-6"></path>
                    <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                    <path d="M3 22v-6h6"></path>
                    <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                  </svg>
                  {selectedImage.positive_prompt ? "Recreate Image" : "Metadata Missing"}
                </button>

                <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                  <button
                    disabled={!selectedImage.positive_prompt}
                    onClick={() => onModify(selectedImage)}
                    className="bg-zinc-800/80 hover:bg-zinc-700 disabled:bg-zinc-800/50 disabled:text-zinc-500 text-white px-4 py-3.5 rounded-[20px] lg:rounded-[24px] font-bold text-[10px] sm:text-xs lg:text-sm transition-all flex items-center justify-center gap-2 sm:gap-3 active:scale-95 group disabled:cursor-not-allowed border border-white/5"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLineJoin="round" className="sm:w-5 sm:h-5"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    Modify
                  </button>

                  <button
                    onClick={() => onDownload(selectedImage)}
                    className="bg-zinc-800/80 hover:bg-zinc-700 text-white px-4 py-3.5 rounded-[20px] lg:rounded-[24px] font-bold text-[10px] sm:text-xs lg:text-sm transition-all flex items-center justify-center gap-2 sm:gap-3 active:scale-95 group border border-white/5"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLineJoin="round" className="sm:w-5 sm:h-5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Download
                  </button>

                  {!isCollectionMode && onSavePrompt && (
                    <button
                      onClick={() => onSavePrompt(selectedImage)}
                      className="bg-zinc-800/80 hover:bg-zinc-700 text-white px-4 py-3.5 rounded-[20px] lg:rounded-[24px] font-bold text-[10px] sm:text-xs lg:text-sm transition-all flex items-center justify-center gap-2 sm:gap-3 active:scale-95 group border border-white/5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLineJoin="round" className="sm:w-5 sm:h-5">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                      </svg>
                      Save Prompt
                    </button>
                  )}

                  {!isCollectionMode && onSaveToCollection && (
                    <button
                      onClick={() => onSaveToCollection(selectedImage)}
                      className="bg-indigo-600/80 hover:bg-indigo-500 text-white px-4 py-3.5 rounded-[20px] lg:rounded-[24px] font-bold text-[10px] sm:text-xs lg:text-sm transition-all flex items-center justify-center gap-2 sm:gap-3 active:scale-95 group border border-white/5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLineJoin="round" className="sm:w-5 sm:h-5">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        <line x1="12" y1="11" x2="12" y2="17"></line>
                        <line x1="9" y1="14" x2="15" y2="14"></line>
                      </svg>
                      Add to Collection
                    </button>
                  )}

                  {isCollectionMode && onDelete && (
                    <button
                      onClick={() => onDelete(selectedImage.id)}
                      className="bg-red-600/20 hover:bg-red-600/30 text-red-400 px-4 py-3.5 rounded-[20px] lg:rounded-[24px] font-bold text-[10px] sm:text-xs lg:text-sm transition-all flex items-center justify-center gap-2 sm:gap-3 active:scale-95 group border border-red-500/10"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLineJoin="round" className="sm:w-5 sm:h-5">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                      Remove from Collection
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 sm:gap-3 bg-white/5 p-4 sm:p-5 rounded-[24px] border border-white/5">
                   <div className="flex items-center justify-between px-1">
                      <span className="text-[8px] sm:text-[9px] font-bold text-white/30 uppercase tracking-widest">Resolution</span>
                      <span className="text-[10px] sm:text-xs text-white/80 font-mono font-bold">
                        {selectedImage.width ? `${selectedImage.width}×${selectedImage.height}` : "N/A"}
                      </span>
                   </div>
                   <div className="flex items-center justify-between px-1 lg:pt-3 lg:border-t lg:border-white/5">
                      <span className="text-[8px] sm:text-[9px] font-bold text-white/30 uppercase tracking-widest">Steps</span>
                      <span className="text-[10px] sm:text-xs text-white/80 font-mono font-bold">
                        {selectedImage.steps || "N/A"}
                      </span>
                   </div>
                </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1 z-10"
      title="Copy to clipboard"
    >
      {copied ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round" className="text-emerald-400">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      )}
    </button>
  );
};
