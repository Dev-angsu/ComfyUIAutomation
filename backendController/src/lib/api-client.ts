const API_BASE = "http://localhost:8000/api";

export interface GenerationParams {
  width?: number;
  height?: number;
  steps?: number;
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

  async uploadCSVBatch(file: File) {
    const formData = new FormData();
    formData.append("file", file);

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

  async uploadJSONBatch(file: File, count: number = 1) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("count", count.toString());

    const response = await fetch(`${API_BASE}/batch/json/upload`, {
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
};
