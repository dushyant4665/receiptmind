import axios from "axios";
import type { AxiosRequestConfig } from "axios";
import type { ApiResponse } from "@/types";
import { getApiUrl } from "@/lib/env";

const API_BASE_URL = getApiUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
});

let isRedirecting = false;
let authToken: string | null = null;

export function setApiAuthToken(token?: string | null) {
  authToken = token ?? null;
}

apiClient.interceptors.request.use((config) => {
  if (authToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined" && !isRedirecting) {
        isRedirecting = true;
        import("next-auth/react").then(({ signOut }) => {
          signOut({ callbackUrl: "/login", redirect: true }).finally(() => {
            isRedirecting = false;
          });
        });
      }
    }

    if (error.response) {
      const customError = new Error(error.response.data?.error || error.message);
      (customError as { status?: number }).status = error.response.status;
      throw customError;
    }
    throw error;
  }
);

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

export async function deleteApiData<TResponse>(
  path: string,
  options?: { authToken?: string; config?: AxiosRequestConfig },
): Promise<TResponse> {
  const response = await apiClient.delete<ApiResponse<TResponse> | TResponse>(
    path,
    getRequestConfig(options?.authToken, options?.config),
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

export async function patchApiData<TResponse, TBody = unknown>(
  path: string,
  body?: TBody,
  options?: { authToken?: string; config?: AxiosRequestConfig },
): Promise<TResponse> {
  const response = await apiClient.patch<ApiResponse<TResponse> | TResponse>(
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
