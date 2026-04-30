export const BACKEND_URL = `http://${window.location.hostname}:8000`;
const API_BASE = `${BACKEND_URL}/api`;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Authorization": token ? `Bearer ${token}` : "",
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
};

export interface GenerationParams {
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  sampler_name?: string;
  scheduler?: string;
  denoise?: number;
  unet?: string;
  vae?: string;
  clip?: string;
  workflow?: string;
}

export interface AppConfig {
  default_width: number;
  default_height: number;
  ksampler_steps: number;
  ksampler_cfg: number;
  ksampler_sampler_name: string;
  ksampler_scheduler: string;
  ksampler_denoise: number;
  default_unet: string;
  default_vae: string;
  default_clip: string;
  available_workflows: string[];
  default_workflow: string;
}

export interface GenerationRequest {
  positive_prompt: string;
  negative_prompt?: string;
  params?: GenerationParams;
  job_type?: string;
}

export const apiClient = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  async login(formData: FormData) {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error("Login failed");
    return response.json();
  },

  async register(data: any) {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Registration failed");
    return response.json();
  },

  async getMe() {
    const response = await fetch(`${API_BASE}/auth/me`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error = new Error("Failed to fetch user profile") as any;
      error.status = response.status;
      throw error;
    }
    return response.json();
  },

  // ── Generation ────────────────────────────────────────────────────────────
  async generateSingle(data: GenerationRequest) {
    const response = await fetch(`${API_BASE}/generate`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to enqueue generation");
    return response.json();
  },

  async getQueueStats() {
    const response = await fetch(`${API_BASE}/queue`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch queue stats");
    return response.json();
  },

  async getTasks() {
    const response = await fetch(`${API_BASE}/tasks`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch tasks");
    return response.json();
  },

  async getTaskStatus(taskId: string) {
    const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch task status");
    return response.json();
  },

  async deleteTask(taskId: string) {
    const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to delete task");
    return response.json();
  },

  async deleteAllTasks() {
    const response = await fetch(`${API_BASE}/tasks`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to clear tasks");
    return response.json();
  },

  async uploadCSVBatch(
    file: File, 
    params?: GenerationParams,
    randomization?: {
      randomize_size: boolean;
      min_ratio: number;
      max_ratio: number;
      min_res: number;
      max_res: number;
    }
  ) {
    const formData = new FormData();
    formData.append("file", file);
    if (params) {
      formData.append("global_params_json", JSON.stringify(params));
    }
    if (randomization) {
      formData.append("randomize_size", String(randomization.randomize_size));
      formData.append("min_ratio", String(randomization.min_ratio));
      formData.append("max_ratio", String(randomization.max_ratio));
      formData.append("min_res", String(randomization.min_res));
      formData.append("max_res", String(randomization.max_res));
    }

    const headers = { ...getAuthHeaders() };
    delete (headers as any)["Content-Type"]; // Let browser set boundary

    const response = await fetch(`${API_BASE}/batch/csv/upload`, {
      method: "POST",
      headers: headers,
      body: formData,
    });
    if (!response.ok) throw new Error("Failed to upload CSV batch");
    return response.json();
  },

  async queueCSVBatch(data: any) {
    const response = await fetch(`${API_BASE}/batch/csv`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to queue CSV batch");
    return response.json();
  },

  async getGallery(page: number = 1, pageSize: number = 24) {
    const response = await fetch(`${API_BASE}/gallery?page=${page}&page_size=${pageSize}`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch gallery");
    return response.json();
  },

  async getGalleryAll() {
    const response = await fetch(`${API_BASE}/gallery/all`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch all gallery images");
    return response.json();
  },

  async getConfig(): Promise<AppConfig> {
    const response = await fetch(`${API_BASE}/config`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch app config");
    return response.json();
  },

  async getPromptGuidelines(): Promise<{ content: string }> {
    const response = await fetch(`${API_BASE}/prompts/guidelines`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch prompt guidelines");
    return response.json();
  },

  async pauseExecution() {
    const response = await fetch(`${API_BASE}/pause`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to pause execution");
    return response.json();
  },

  async resumeExecution() {
    const response = await fetch(`${API_BASE}/resume`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to resume execution");
    return response.json();
  },

  async getPauseStatus() {
    const response = await fetch(`${API_BASE}/pause-status`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch pause status");
    return response.json();
  },

  // ── Prompts Zone ──────────────────────────────────────────────────────────
  async getCollections(): Promise<PromptCollection[]> {
    const response = await fetch(`${API_BASE}/prompts/collections`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch collections");
    return response.json();
  },

  async createCollection(name: string): Promise<PromptCollection> {
    const response = await fetch(`${API_BASE}/prompts/collections`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error("Failed to create collection");
    return response.json();
  },

  async deleteCollection(id: number) {
    const response = await fetch(`${API_BASE}/prompts/collections/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to delete collection");
    return response.json();
  },

  async getPrompts(collectionId?: number): Promise<SavedPrompt[]> {
    const url = collectionId !== undefined 
      ? `${API_BASE}/prompts/?collection_id=${collectionId}`
      : `${API_BASE}/prompts/`;
    const response = await fetch(url, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch prompts");
    return response.json();
  },

  async createPrompt(prompt: Partial<SavedPrompt>): Promise<SavedPrompt> {
    const response = await fetch(`${API_BASE}/prompts/`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(prompt),
    });
    if (!response.ok) throw new Error("Failed to save prompt");
    return response.json();
  },

  async updatePrompt(id: number, updates: Partial<SavedPrompt>): Promise<SavedPrompt> {
    const response = await fetch(`${API_BASE}/prompts/${id}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error("Failed to update prompt");
    return response.json();
  },

  async deletePrompt(id: number) {
    const response = await fetch(`${API_BASE}/prompts/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to delete prompt");
    return response.json();
  },

  async getBuilderConfig(): Promise<BuilderConfig> {
    const response = await fetch(`${API_BASE}/prompts/builder-config`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch builder config");
    return response.json();
  },
};

export interface SavedPrompt {
  id: number;
  name: string;
  positive_prompt: string;
  negative_prompt?: string;
  steps?: number;
  width?: number;
  height?: number;
  is_liked: boolean;
  collection_id?: number;
  user_id: number;
  created_at: string;
}

export interface PromptCollection {
  id: number;
  name: string;
  user_id: number;
  created_at: string;
  prompts: SavedPrompt[];
}

export interface BuilderConfig {
  character: Record<string, string[]>;
  outfit: Record<string, string[]>;
  background: Record<string, string[]>;
}
