import React, { useState, useEffect, useCallback, useRef } from "react";
import { apiClient, BuilderConfig, PromptCollection } from "../lib/api-client";
import { useSettings } from "../lib/settings-context";
import { useToast } from "../lib/toast-context";
import { useLocalStorage } from "../lib/useLocalStorage";

// ─── Constants ────────────────────────────────────────────────────────────────
const RANDOM_VALUE = "__random__";
const NONE_VALUE = "__none__";

const CATEGORY_LABELS: Record<string, string> = {
  // Character
  gender: "Gender", body: "Body", chest: "Chest",
  skin_color: "🌈 Skin C.", eye_color: "🌈 Eye C.", hair_color: "🌈 Hair C.",
  hair_length: "Hair Length", hair_type: "Hair Type", hair_style: "Hair Style",
  bangs: "Bangs", misc: "Misc", angle: "Angle", gaze: "Gaze",
  emotion: "😊 Emotion", action: "Action",
  // Outfit
  fabric: "Fabric", outfit_set: "Outfit Set", outfit: "Outfit 🌈",
  my_set: "My Set", anime_cosplay: "Anime Cosplay", outwear: "Outwear",
  torso: "Torso", sleeves: "Sleeves", waist: "Waist", legs: "Legs",
  foot: "Foot", head: "Head", hands: "Hands",
  acc1: "Acc 🌈", acc2: "Acc 🌈", acc3: "Acc 🌈",
  // Background
  custom_bg: "Custom BG", bg_angle: "Angle", color_scheme: "Color Scheme",
  exterior_bg: "🏃 Exterior BG", interior_bg: "🏛 Interior BG",
  time: "🔔 Time", weather: "💬 Weather",
};

// Character section field order (matching the uploaded images)
const CHARACTER_FIELDS = [
  "gender", "body", "chest",
  "skin_color", "eye_color", "hair_color",
  "hair_length", "hair_type", "hair_style", "bangs", "misc",
  "angle", "gaze", "emotion", "action",
];

const OUTFIT_FIELDS = [
  "fabric", "outfit_set", "outfit", "my_set", "anime_cosplay",
  "outwear", "torso", "sleeves",
  "waist", "legs", "foot",
  "head", "hands",
  "acc1", "acc2", "acc3",
];

const BACKGROUND_FIELDS = [
  "custom_bg", "bg_angle", "color_scheme",
  "exterior_bg", "interior_bg", "time", "weather",
];

// Row groupings for multi-column layout
const CHARACTER_ROWS: string[][] = [
  ["gender", "body", "chest"],
  ["skin_color", "eye_color", "hair_color"],
  ["hair_length", "hair_type", "hair_style", "bangs", "misc"],
  ["angle", "gaze", "emotion", "action"],
];
const OUTFIT_ROWS: string[][] = [
  ["fabric", "outfit_set", "outfit", "my_set", "anime_cosplay"],
  ["outwear", "torso", "sleeves"],
  ["waist", "legs", "foot"],
  ["head", "hands"],
  ["acc1", "acc2", "acc3"],
];
const BACKGROUND_ROWS: string[][] = [
  ["custom_bg", "bg_angle", "color_scheme"],
  ["exterior_bg", "interior_bg", "time", "weather"],
];

// ─── Prompt Assembly Engine ────────────────────────────────────────────────────
function resolveValue(
  field: string,
  selection: string,
  config: BuilderConfig,
  category: "character" | "outfit" | "background"
): string | null {
  if (selection === NONE_VALUE) return null;
  const list = (config[category] as Record<string, string[]>)[field] ?? [];
  if (selection === RANDOM_VALUE) {
    if (list.length === 0) return null;
    return list[Math.floor(Math.random() * list.length)];
  }
  return selection || null;
}

function buildPrompt(
  selections: Record<string, string>,
  config: BuilderConfig,
  customFinal?: Record<string, string>
): string {
  const resolved = customFinal ?? {};
  if (!customFinal) {
    for (const field of CHARACTER_FIELDS) {
      resolved[field] = resolveValue(field, selections[field] ?? RANDOM_VALUE, config, "character") ?? "";
    }
    for (const field of OUTFIT_FIELDS) {
      const cat = field === "my_set" ? "outfit" : "outfit";
      resolved[field] = resolveValue(field, selections[field] ?? RANDOM_VALUE, config, "outfit") ?? "";
    }
    for (const field of BACKGROUND_FIELDS) {
      const realField = field === "bg_angle" ? "angle" : field;
      const bgConfig = { ...config.background };
      if (field === "bg_angle") {
        resolved[field] = resolveValue("angle", selections[field] ?? RANDOM_VALUE, { character: {}, outfit: {}, background: bgConfig }, "background") ?? "";
      } else {
        resolved[field] = resolveValue(field, selections[field] ?? RANDOM_VALUE, config, "background") ?? "";
      }
    }
  }

  const parts: string[] = [];

  // Quality prefix (from prompt.txt guidelines)
  parts.push("masterpiece, best quality, score_7, safe");

  // Subject
  if (resolved.gender) parts.push(resolved.gender);

  // Character appearance
  const appearanceTags = [
    resolved.hair_color, resolved.hair_length, resolved.hair_type,
    resolved.hair_style, resolved.bangs, resolved.eye_color,
    resolved.skin_color, resolved.chest, resolved.body, resolved.misc,
  ].filter(Boolean);
  if (appearanceTags.length) parts.push(...appearanceTags);

  // Pose / expression
  const poseTags = [
    resolved.emotion, resolved.gaze, resolved.angle, resolved.action,
  ].filter(Boolean);
  if (poseTags.length) parts.push(...poseTags);

  // Outfit
  const outfitTags = OUTFIT_FIELDS.map(f => resolved[f]).filter(Boolean);
  if (outfitTags.length) parts.push(...outfitTags);

  // Background
  const bgTags = BACKGROUND_FIELDS.map(f => resolved[f]).filter(Boolean);
  if (bgTags.length) parts.push(...bgTags);

  return parts.join(", ");
}

// ─── Sub-components ───────────────────────────────────────────────────────────
interface DropdownProps {
  field: string;
  options: string[];
  value: string;
  onChange: (field: string, val: string) => void;
}

const BuilderDropdown: React.FC<DropdownProps> = ({ field, options, value, onChange }) => {
  const label = CATEGORY_LABELS[field] ?? field.replace(/_/g, " ");
  return (
    <div className="builder-field">
      <label className="builder-field-label">{label}</label>
      <div className="builder-field-row">
        <select
          className="builder-select"
          value={value}
          onChange={e => onChange(field, e.target.value)}
          title={label}
        >
          <option value={RANDOM_VALUE}>🎲 Random</option>
          <option value={NONE_VALUE}>– None</option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

interface SectionProps {
  title: string;
  icon: string;
  rows: string[][];
  fields: Record<string, string[]>;
  selections: Record<string, string>;
  onChange: (field: string, val: string) => void;
  accentColor: string;
}

const BuilderSection: React.FC<SectionProps> = ({
  title, icon, rows, fields, selections, onChange, accentColor
}) => {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="builder-section" style={{ "--accent": accentColor } as React.CSSProperties}>
      <button
        type="button"
        className="builder-section-header"
        onClick={() => setCollapsed(c => !c)}
      >
        <span className="builder-section-icon">{icon}</span>
        <span className="builder-section-title">{title}</span>
        <span className="builder-section-chevron" style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>▾</span>
      </button>
      {!collapsed && (
        <div className="builder-section-body">
          {rows.map((row, ri) => (
            <div key={ri} className="builder-row" style={{ gridTemplateColumns: `repeat(${row.length}, 1fr)` }}>
              {row.map(field => (
                <BuilderDropdown
                  key={field}
                  field={field}
                  options={fields[field === "bg_angle" ? "angle" : field] ?? []}
                  value={selections[field] ?? RANDOM_VALUE}
                  onChange={onChange}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
export const PromptBuilder: React.FC = () => {
  const { addToast } = useToast();
  const { settings } = useSettings();

  const [config, setConfig] = useState<BuilderConfig>({ character: {}, outfit: {}, background: {} });
  const [configLoading, setConfigLoading] = useState(true);
  
  // Builder State (Persisted)
  const [selections, setSelections] = useLocalStorage<Record<string, string>>("builder_selections", {});
  const [batchCount, setBatchCount] = useLocalStorage<number>("builder_batch_count", 1);
  const [randomizeBatch, setRandomizeBatch] = useLocalStorage<boolean>("builder_randomize_batch", true);

  // Randomization Settings (Shared with BatchUploader)
  const [randomizeSize, setRandomizeSize] = useLocalStorage("batch_randomize_size", false);
  const [minRatio, setMinRatio] = useLocalStorage("batch_min_ratio", 0.5);
  const [maxRatio, setMaxRatio] = useLocalStorage("batch_max_ratio", 2.0);
  const [minRes, setMinRes] = useLocalStorage("batch_min_res", 512);
  const [maxRes, setMaxRes] = useLocalStorage("batch_max_res", 1024);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [finalPrompt, setFinalPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastTask, setLastTask] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("Builder Prompt");
  const [saveCollectionId, setSaveCollectionId] = useState<number | undefined>(undefined);
  const [availableCollections, setAvailableCollections] = useState<PromptCollection[]>([]);

  // Load config from backend
  useEffect(() => {
    apiClient.getBuilderConfig()
      .then(cfg => setConfig(cfg))
      .catch(() => addToast("Could not load builder config. Check backend.", "error"))
      .finally(() => setConfigLoading(false));
  }, []);

  // Resolve and update final prompt whenever selections change
  const refreshPrompt = useCallback(() => {
    if (!config.character.gender) return;
    const prompt = buildPrompt(selections, config);
    setFinalPrompt(prompt);
  }, [selections, config, refreshTrigger]);

  useEffect(() => { refreshPrompt(); }, [refreshPrompt]);

  const handleChange = (field: string, val: string) => {
    setSelections(prev => ({ ...prev, [field]: val }));
  };

  const handleReset = () => {
    setSelections({});
    setBatchCount(1);
    setRandomizeBatch(true);
    setRandomizeSize(false);
    setMinRatio(0.5);
    setMaxRatio(2.0);
    setMinRes(512);
    setMaxRes(1024);
  };

  const handleRandomise = () => {
    // Force a re-resolve of all random fields without changing selections
    setRefreshTrigger(prev => prev + 1);
  };

  const buildOnePrompt = () => buildPrompt(selections, config);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const promises: Promise<any>[] = [];
      for (let i = 0; i < batchCount; i++) {
        const prompt = randomizeBatch || i === 0 ? buildOnePrompt() : finalPrompt;
        
        let width = settings.width;
        let height = settings.height;

        if (randomizeSize) {
          const ratio = Math.random() * (maxRatio - minRatio) + minRatio;
          const res = Math.floor(Math.random() * (maxRes - minRes + 1)) + minRes;
          if (ratio >= 1) {
            width = res;
            height = res / ratio;
          } else {
            height = res;
            width = res * ratio;
          }
          width = Math.round(width / 8) * 8;
          height = Math.round(height / 8) * 8;
        }

        promises.push(apiClient.generateSingle({
          positive_prompt: prompt,
          negative_prompt: settings.negativePrompt,
          job_type: "BUILDER",
          params: {
            width,
            height,
            steps: settings.steps,
            workflow: settings.workflow,
          },
        }));
        if (randomizeBatch && i === batchCount - 1) {
          setFinalPrompt(prompt);
        }
      }
      const results = await Promise.all(promises);
      setLastTask(results[results.length - 1].task_id);
      addToast(`✨ Queued ${batchCount} task${batchCount > 1 ? "s" : ""} from Builder!`, "success");
    } catch {
      addToast("Failed to dispatch job.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSave = async () => {
    setShowSaveModal(true);
    try {
      const cols = await apiClient.getCollections();
      setAvailableCollections(cols);
    } catch { /* ignore */ }
  };

  const handleSave = async () => {
    try {
      await apiClient.createPrompt({
        name: saveName || "Builder Prompt",
        positive_prompt: finalPrompt,
        negative_prompt: settings.negativePrompt,
        width: settings.width,
        height: settings.height,
        steps: settings.steps,
        collection_id: saveCollectionId,
      });
      addToast("✨ Prompt saved to Prompts Zone!", "success");
      setShowSaveModal(false);
    } catch {
      addToast("Failed to save prompt.", "error");
    }
  };

  if (configLoading) {
    return (
      <div className="builder-loading">
        <div className="builder-spinner" />
        <span>Loading Builder Config…</span>
      </div>
    );
  }

  const bgConfig: Record<string, string[]> = {
    ...config.background,
    bg_angle: config.background.angle ?? [],
  };

  return (
    <div className="builder-root">
      {/* Sections */}
      <BuilderSection
        title="Character" icon="👤" rows={CHARACTER_ROWS}
        fields={config.character} selections={selections}
        onChange={handleChange} accentColor="#818cf8"
      />
      <BuilderSection
        title="Outfit" icon="👗" rows={OUTFIT_ROWS}
        fields={config.outfit} selections={selections}
        onChange={handleChange} accentColor="#c084fc"
      />
      <BuilderSection
        title="Background" icon="🌄" rows={BACKGROUND_ROWS}
        fields={bgConfig} selections={selections}
        onChange={handleChange} accentColor="#34d399"
      />

      {/* Final Prompt */}
      <div className="builder-final">
        <div className="builder-final-header">
          <span className="builder-final-label">✨ Final Prompt</span>
          <button
            type="button"
            className="builder-copy-btn"
            onClick={() => { navigator.clipboard.writeText(finalPrompt); addToast("Copied!", "success"); }}
            title="Copy to clipboard"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            Copy
          </button>
        </div>
        <textarea
          className="builder-final-textarea"
          value={finalPrompt}
          onChange={e => setFinalPrompt(e.target.value)}
          rows={4}
          placeholder="Click 🎲 Randomise or adjust dropdowns to build your prompt…"
        />
        {lastTask && (
          <span className="builder-dispatched">✓ Dispatched: {lastTask.substring(0, 8)}…</span>
        )}
      </div>

      {/* Randomize Size Section */}
      <div className="bg-black/20 border border-zinc-800/50 rounded-xl p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${randomizeSize ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-500'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round">
                <path d="M21 16V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"></path>
                <path d="M7 12h10"></path>
                <path d="M12 7v10"></path>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">Randomize Aspect Ratio & Resolution</h3>
              <p className="text-xs text-zinc-500">Each image will get unique dimensions</p>
            </div>
          </div>
          <button
            onClick={() => setRandomizeSize(!randomizeSize)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${randomizeSize ? 'bg-indigo-600' : 'bg-zinc-700'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${randomizeSize ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {randomizeSize && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Aspect Ratio Range</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={minRatio}
                  onChange={(e) => setMinRatio(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/50"
                  placeholder="Min"
                />
                <span className="text-zinc-600">to</span>
                <input
                  type="number"
                  step="0.1"
                  value={maxRatio}
                  onChange={(e) => setMaxRatio(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/50"
                  placeholder="Max"
                />
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Resolution (Long Edge)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={minRes}
                  onChange={(e) => setMinRes(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/50"
                  placeholder="Min"
                />
                <span className="text-zinc-600">to</span>
                <input
                  type="number"
                  value={maxRes}
                  onChange={(e) => setMaxRes(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/50"
                  placeholder="Max"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="builder-actions">
        <div className="builder-actions-left">
          <button type="button" className="builder-btn builder-btn-ghost" onClick={handleReset} title="Reset all to Random">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.26"/></svg>
            Reset
          </button>
          <button type="button" className="builder-btn builder-btn-accent" onClick={handleRandomise} title="Randomise all random fields">
            🎲 Randomise
          </button>
        </div>

        <div className="builder-actions-right">
          {/* Batch controls */}
          <div className="builder-batch-group">
            <label className="builder-batch-label">Batch</label>
            <input
              type="number" min={1} max={50} value={batchCount}
              onChange={e => setBatchCount(Number(e.target.value))}
              className="builder-batch-input"
            />
            {batchCount > 1 && (
              <label className="builder-toggle-label" title="Re-randomize random fields for each image in batch">
                <input
                  type="checkbox"
                  checked={randomizeBatch}
                  onChange={e => setRandomizeBatch(e.target.checked)}
                  className="builder-toggle-check"
                />
                <span className="builder-toggle-text">Re-randomize</span>
              </label>
            )}
          </div>

          <button type="button" className="builder-btn builder-btn-ghost" onClick={handleOpenSave}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            Save
          </button>
          <button
            type="button"
            className="builder-btn builder-btn-primary"
            onClick={handleSubmit}
            disabled={loading || !finalPrompt}
          >
            {loading ? "Queuing…" : `Generate${batchCount > 1 ? ` ×${batchCount}` : ""}`}
          </button>
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="builder-modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="builder-modal" onClick={e => e.stopPropagation()}>
            <h2 className="builder-modal-title">Save Builder Prompt</h2>
            <div className="builder-modal-fields">
              <div className="builder-modal-field">
                <label className="builder-modal-label">Prompt Name</label>
                <input type="text" value={saveName} onChange={e => setSaveName(e.target.value)} className="builder-modal-input" />
              </div>
              <div className="builder-modal-field">
                <label className="builder-modal-label">Collection (Optional)</label>
                <select
                  value={saveCollectionId ?? ""}
                  onChange={e => setSaveCollectionId(e.target.value ? Number(e.target.value) : undefined)}
                  className="builder-modal-input"
                >
                  <option value="">No Collection</option>
                  {availableCollections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="builder-modal-actions">
              <button type="button" className="builder-btn builder-btn-ghost" onClick={() => setShowSaveModal(false)}>Cancel</button>
              <button type="button" className="builder-btn builder-btn-primary" onClick={handleSave}>Save Prompt</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
