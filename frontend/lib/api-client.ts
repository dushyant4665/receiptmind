import axios from "axios";
import type { AxiosRequestConfig } from "axios";
import type { ApiResponse } from "@/types";
import { getApiUrl } from "@/lib/env";

const API_BASE_URL = getApiUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
});

function getRequestConfig(authToken?: string, config?: AxiosRequestConfig): AxiosRequestConfig {
  return {
    ...config,
    headers: {
      ...(config?.headers ?? {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  };
}

function unwrapApiPayload<T>(payload: ApiResponse<T> | T): T {
  if (typeof payload === "object" && payload !== null && "data" in payload) {
    return payload.data as T;
  }

  return payload as T;
}

export async function getApiData<T>(
  path: string,
  options?: { authToken?: string; config?: AxiosRequestConfig },
): Promise<T> {
  const response = await apiClient.get<ApiResponse<T> | T>(
    path,
    getRequestConfig(options?.authToken, options?.config),
  );

  return unwrapApiPayload<T>(response.data);
}

export async function postApiData<TResponse, TBody = unknown>(
  path: string,
  body?: TBody,
  options?: { authToken?: string; config?: AxiosRequestConfig },
): Promise<TResponse> {
  const response = await apiClient.post<ApiResponse<TResponse> | TResponse>(
    path,
    body,
    getRequestConfig(options?.authToken, {
      headers: {
        "Content-Type": "application/json",
      },
      ...options?.config,
    }),
  );

  return unwrapApiPayload<TResponse>(response.data);
}

export async function putApiData<TResponse, TBody = unknown>(
  path: string,
  body?: TBody,
  options?: { authToken?: string; config?: AxiosRequestConfig },
): Promise<TResponse> {
  const response = await apiClient.put<ApiResponse<TResponse> | TResponse>(
    path,
    body,
    getRequestConfig(options?.authToken, {
      headers: {
        "Content-Type": "application/json",
      },
      ...options?.config,
    }),
  );

  return unwrapApiPayload<TResponse>(response.data);
}

export async function uploadApiData<TResponse>(
  path: string,
  formData: FormData,
  options?: { authToken?: string; config?: AxiosRequestConfig },
): Promise<TResponse> {
  const response = await apiClient.post<ApiResponse<TResponse> | TResponse>(
    path,
    formData,
    getRequestConfig(options?.authToken, {
      ...options?.config,
      headers: {
        ...(options?.config?.headers ?? {}),
        "Content-Type": "multipart/form-data",
      },
    }),
  );

  return unwrapApiPayload<TResponse>(response.data);
}
