import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    return `${(ms / 60000).toFixed(1)}m`;
  }
}

export function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString();
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'pending':
      return 'text-gray-500';
    case 'in_progress':
      return 'text-blue-500';
    case 'completed':
      return 'text-green-500';
    case 'failed':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
}

export function getStepIcon(type: string): string {
  switch (type) {
    case 'perception':
      return '👁️';
    case 'synthesis':
      return '🔧';
    case 'execution':
      return '⚡';
    case 'validation':
      return '✅';
    default:
      return '📋';
  }
}