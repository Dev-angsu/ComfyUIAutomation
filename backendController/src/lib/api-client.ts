const API_BASE = `http://${window.location.hostname}:8000/api`;

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
  async generateSingle(data: GenerationRequest) {
    const response = await fetch(`${API_BASE}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to enqueue generation");
    return response.json();
  },

  async getQueueStats() {
    const response = await fetch(`${API_BASE}/queue`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Failed to fetch queue stats");
    return response.json();
  },

  async getTasks() {
    const response = await fetch(`${API_BASE}/tasks`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Failed to fetch tasks");
    return response.json();
  },

  async getTaskStatus(taskId: string) {
    const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Failed to fetch task status");
    return response.json();
  },

  async deleteTask(taskId: string) {
    const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Failed to delete task");
    return response.json();
  },

  async deleteAllTasks() {
    const response = await fetch(`${API_BASE}/tasks`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
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

    const response = await fetch(`${API_BASE}/batch/csv/upload`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error("Failed to upload CSV batch");
    return response.json();
  },

  async queueCSVBatch(data: any) {
    const response = await fetch(`${API_BASE}/batch/csv`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to queue CSV batch");
    return response.json();
  },

  async uploadJSONBatch(file: File, params?: GenerationParams) {
    const formData = new FormData();
    formData.append("file", file);
    if (params) {
      formData.append("global_params_json", JSON.stringify(params));
    }

    // The csv/upload endpoint handles both .csv and .json via JobLoader
    const response = await fetch(`${API_BASE}/batch/csv/upload`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error("Failed to upload JSON batch");
    return response.json();
  },

  async queueJSONBatch(data: any) {
    const response = await fetch(`${API_BASE}/batch/json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to queue JSON batch");
    return response.json();
  },

  async getGallery() {
    const response = await fetch(`${API_BASE}/gallery`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Failed to fetch gallery");
    return response.json();
  },

  async getGalleryAll() {
    const response = await fetch(`${API_BASE}/gallery/all`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Failed to fetch full gallery");
    return response.json();
  },

  async getConfig(): Promise<AppConfig> {
    const response = await fetch(`${API_BASE}/config`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Failed to fetch app config");
    return response.json();
  },

  async getPromptGuidelines(): Promise<{ content: string }> {
    const response = await fetch(`${API_BASE}/prompts/guidelines`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Failed to fetch prompt guidelines");
    return response.json();
  },
};
