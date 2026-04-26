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
    if (!response.ok) throw new Error("Failed to fetch user profile");
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

  async uploadCSVBatch(file: File, params?: GenerationParams) {
    const formData = new FormData();
    formData.append("file", file);
    if (params) {
      formData.append("global_params_json", JSON.stringify(params));
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
};
