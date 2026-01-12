import type { ComputedRef } from 'vue';

export interface UploadItem {
  completedAt?: Date;
  error?: string;
  file: File;
  id: string;
  metadata?: Record<string, string>;
  progress: UploadProgress;
  startedAt?: Date;
  status: UploadStatus;
  url?: string;
}

export interface UploadOptions {
  autoStart?: boolean;
  chunkSize?: number;
  endpoint?: string;
  headers?: Record<string, string>;
  metadata?: Record<string, string>;
  onError?: (item: UploadItem, error: Error) => void;
  onProgress?: (item: UploadItem) => void;
  onSuccess?: (item: UploadItem) => void;
  parallelUploads?: number;
  retryDelays?: number[];
}

export interface UploadProgress {
  bytesTotal: number;
  bytesUploaded: number;
  percentage: number;
  remainingTime: number; // seconds
  speed: number; // bytes/second
}

export type UploadStatus = 'completed' | 'error' | 'idle' | 'paused' | 'uploading';

export interface UseTusUploadReturn {
  // Actions
  addFiles: (files: File | File[]) => string[];
  cancelAll: () => void;
  cancelUpload: (id: string) => void;
  clearCompleted: () => void;
  getUpload: (id: string) => undefined | UploadItem;

  // State
  isUploading: ComputedRef<boolean>;
  pauseAll: () => void;
  pauseUpload: (id: string) => void;
  removeUpload: (id: string) => void;
  resumeAll: () => void;
  resumeUpload: (id: string) => void;
  retryUpload: (id: string) => void;
  startAll: () => void;
  startUpload: (id: string) => void;
  totalProgress: ComputedRef<UploadProgress>;
  uploads: ComputedRef<UploadItem[]>;
}
