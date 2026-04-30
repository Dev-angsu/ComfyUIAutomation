import React, { useState, useEffect } from "react";
import { apiClient, SavedPrompt, PromptCollection } from "../lib/api-client";
import { useSettings } from "../lib/settings-context";
import { useToast } from "../lib/toast-context";
import { useConfirm } from "../lib/confirm-context";

interface PromptsZoneProps {
  onTakePrompt: () => void;
}

export const PromptsZone: React.FC<PromptsZoneProps> = ({ onTakePrompt }) => {
  const { addToast } = useToast();
  const { confirm } = useConfirm();
  const { updateSettings } = useSettings();
  const [collections, setCollections] = useState<PromptCollection[]>([]);
  const [uncollectedPrompts, setUncollectedPrompts] = useState<SavedPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCollections, setExpandedCollections] = useState<Set<number>>(new Set());
  const [showUncategorized, setShowUncategorized] = useState(false);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const cols = await apiClient.getCollections();
      const allPrompts = await apiClient.getPrompts();
      
      // Organize prompts by collection
      const colsWithPrompts = cols.map(c => ({
        ...c,
        prompts: allPrompts.filter(p => p.collection_id === c.id)
      }));
      
      setCollections(colsWithPrompts);
      setUncollectedPrompts(allPrompts.filter(p => !p.collection_id));
      
      // Removed auto-expansion
    } catch (err) {
      addToast("Failed to fetch prompts.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleCollection = (id: number) => {
    const next = new Set(expandedCollections);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedCollections(next);
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    try {
      await apiClient.createCollection(newCollectionName);
      setNewCollectionName("");
      setShowCreateCollection(false);
      addToast("Collection created.", "success");
      fetchData();
    } catch (err) {
      addToast("Failed to create collection.", "error");
    }
  };

  const handleDeleteCollection = async (id: number) => {
    if (await confirm("Delete Collection", "Are you sure? All prompts in this collection will be deleted too.")) {
      try {
        await apiClient.deleteCollection(id);
        addToast("Collection deleted.", "success");
        fetchData();
      } catch (err) {
        addToast("Failed to delete collection.", "error");
      }
    }
  };

  const handleToggleLike = async (prompt: SavedPrompt) => {
    try {
      await apiClient.updatePrompt(prompt.id, { is_liked: !prompt.is_liked });
      fetchData();
    } catch (err) {
      addToast("Failed to update prompt.", "error");
    }
  };

  const handleDeletePrompt = async (id: number) => {
    if (await confirm("Delete Prompt", "Are you sure you want to delete this prompt?")) {
      try {
        await apiClient.deletePrompt(id);
        addToast("Prompt deleted.", "success");
        fetchData();
      } catch (err) {
        addToast("Failed to delete prompt.", "error");
      }
    }
  };

  const handleTakePrompt = (prompt: SavedPrompt) => {
    updateSettings({
      positivePrompt: prompt.positive_prompt,
      negativePrompt: prompt.negative_prompt || "",
      width: prompt.width || 1024,
      height: prompt.height || 1024,
      steps: prompt.steps || 30,
    });
    addToast("Prompt loaded into Studio.", "success");
    onTakePrompt();
  };

  if (loading && collections.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-zinc-700 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Prompts Zone</h1>
          <p className="text-zinc-500 text-sm">Save, organize, and reuse your best creations.</p>
        </div>
        <button
          onClick={() => setShowCreateCollection(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLineJoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          New Collection
        </button>
      </div>

      {showCreateCollection && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <form 
            onSubmit={handleCreateCollection}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <h2 className="text-xl font-bold text-white mb-6">Create Collection</h2>
            <div className="space-y-4 mb-8">
              <label className="text-xs font-black text-zinc-500 uppercase tracking-widest block">Collection Name</label>
              <input
                autoFocus
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="e.g. Anime Styles, Landscape Baselines..."
                className="w-full bg-black/40 border border-zinc-800 rounded-xl p-4 text-white placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowCreateCollection(false)}
                className="flex-1 px-6 py-3 rounded-xl text-zinc-400 font-bold hover:bg-zinc-800 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-6">
        {collections.length === 0 && uncollectedPrompts.length === 0 && !loading && (
          <div className="bg-zinc-900/50 border border-zinc-800 border-dashed rounded-3xl p-20 text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center text-zinc-600 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLineJoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <h3 className="text-lg font-bold text-zinc-400">No saved prompts yet</h3>
            <p className="text-zinc-600 text-sm max-w-xs">Save prompts from the Studio or Gallery to see them here.</p>
          </div>
        )}

        {/* Uncollected Prompts */}
        {uncollectedPrompts.length > 0 && (
          <div className={`bg-zinc-900/30 border rounded-3xl overflow-hidden transition-all duration-300 ${showUncategorized ? "border-zinc-700 ring-1 ring-zinc-700/10" : "border-zinc-800 shadow-sm"}`}>
            <div 
              className={`flex items-center justify-between p-4 sm:p-5 cursor-pointer transition-colors ${showUncategorized ? "bg-zinc-800/50" : "hover:bg-zinc-800/30"}`}
              onClick={() => setShowUncategorized(!showUncategorized)}
            >
              <div className="flex items-center gap-3">
                <div className={`transition-transform duration-300 ${showUncategorized ? "rotate-90" : ""}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLineJoin="round" className="text-zinc-600"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
                <div className="flex flex-col">
                  <h2 className="text-sm font-bold text-white leading-tight">Uncategorized</h2>
                  <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mt-0.5">{uncollectedPrompts.length} Prompts</span>
                </div>
              </div>
            </div>
            
            {showUncategorized && (
              <div className="p-5 sm:p-6 pt-0 border-t border-zinc-800/50 bg-zinc-950/20">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-6">
                  {uncollectedPrompts.map(prompt => (
                    <PromptCard 
                      key={prompt.id} 
                      prompt={prompt} 
                      onDelete={() => handleDeletePrompt(prompt.id)}
                      onLike={() => handleToggleLike(prompt)}
                      onTake={() => handleTakePrompt(prompt)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Collections Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {collections.map(col => (
            <div 
              key={col.id} 
              className={`bg-zinc-900/30 border rounded-3xl overflow-hidden transition-all duration-300 ${expandedCollections.has(col.id) ? "border-indigo-500/30 ring-1 ring-indigo-500/10 col-span-full" : "border-zinc-800 hover:border-zinc-700 shadow-sm"}`}
            >
              <div 
                className={`flex items-center justify-between cursor-pointer transition-colors ${expandedCollections.has(col.id) ? "p-4 sm:p-5 bg-indigo-500/5" : "p-4 sm:p-5 hover:bg-zinc-800/30"}`}
                onClick={() => toggleCollection(col.id)}
              >
                <div className="flex items-center gap-3">
                  <div className={`transition-transform duration-300 ${expandedCollections.has(col.id) ? "rotate-90" : ""}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLineJoin="round" className="text-zinc-600"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </div>
                  <div className="flex flex-col">
                    <h2 className={`text-sm font-bold leading-tight ${expandedCollections.has(col.id) ? "text-indigo-400" : "text-white"}`}>{col.name}</h2>
                    <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mt-0.5">{col.prompts.length} Prompts</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteCollection(col.id); }}
                    className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    title="Delete Collection"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
              </div>

              {expandedCollections.has(col.id) && (
                <div className="p-5 sm:p-6 pt-0 border-t border-zinc-800/50 bg-zinc-950/20">
                  {col.prompts.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-zinc-700 text-xs italic">Empty collection. Move or save prompts here.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-6">
                      {col.prompts.map(prompt => (
                        <PromptCard 
                          key={prompt.id} 
                          prompt={prompt} 
                          onDelete={() => handleDeletePrompt(prompt.id)}
                          onLike={() => handleToggleLike(prompt)}
                          onTake={() => handleTakePrompt(prompt)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const PromptCard: React.FC<{
  prompt: SavedPrompt;
  onDelete: () => void;
  onLike: () => void;
  onTake: () => void;
}> = ({ prompt, onDelete, onLike, onTake }) => {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 group hover:border-zinc-700 hover:shadow-xl hover:shadow-black/20 transition-all relative">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-sm font-bold text-white line-clamp-1 flex-1">{prompt.name}</h3>
        <div className="flex items-center gap-1">
          <button 
            onClick={onLike}
            className={`p-2 rounded-lg transition-all ${prompt.is_liked ? "text-pink-500 bg-pink-500/10" : "text-zinc-600 hover:text-white hover:bg-zinc-800"}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={prompt.is_liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLineJoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
          </button>
          <button 
            onClick={onDelete}
            className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-[11px] text-zinc-400 font-mono leading-relaxed bg-black/30 p-3 rounded-xl border border-zinc-800/50 h-24 overflow-y-auto sleek-scrollbar">
          {prompt.positive_prompt}
        </div>
      </div>

      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 bg-zinc-600 rounded-full"></div>
            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{prompt.width}×{prompt.height}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 bg-zinc-600 rounded-full"></div>
            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{prompt.steps} Steps</span>
          </div>
        </div>
        <button 
          onClick={onTake}
          className="bg-zinc-800 hover:bg-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.15em] px-3 py-1.5 rounded-lg transition-all active:scale-95 border border-zinc-700/50 hover:border-indigo-500/50 shadow-lg"
        >
          Use Prompt
        </button>
      </div>
    </div>
  );
};
