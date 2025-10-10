'use client';

import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { usePromptSubmission } from '@/hooks/use-prompt';

interface PromptInputProps {
  onPromptSubmitted: (response: any) => void;
}

export function PromptInput({ onPromptSubmitted }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const { submitPrompt, loading, error } = usePromptSubmission();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    const response = await submitPrompt(prompt);
    if (response) {
      onPromptSubmitted(response);
      setPrompt('');
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>What would you like to build?</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., CSV viewer with filter and export"
              className="flex-1"
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !prompt.trim()}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {error && (
            <div className="text-sm text-red-500 bg-red-50 p-3 rounded">
              Error: {error}
            </div>
          )}
          
          <div className="text-sm text-gray-500">
            Try: "CSV viewer with filter and export" or "Interactive dashboard with charts"
          </div>
        </form>
      </CardContent>
    </Card>
  );
}