'use client';

import { useState } from 'react';
import { PromptRequest, PromptResponse } from '@isekai/types';

export function usePromptSubmission() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<PromptResponse | null>(null);

  const submitPrompt = async (prompt: string): Promise<PromptResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const promptRequest: PromptRequest = {
        id: generateId(),
        prompt,
        context: {
          userId: 'demo-user',
          sessionId: generateId()
        }
      };

      const response = await fetch('http://localhost:3001/api/v1/prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(promptRequest),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: PromptResponse = await response.json();
      setResponse(data);
      return data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    submitPrompt,
    loading,
    error,
    response
  };
}

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}