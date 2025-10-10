'use client';

import { useState } from 'react';
import { PromptInput } from '@/components/prompt-input';
import { PlanViewer } from '@/components/plan-viewer';
import { AppViewer } from '@/components/app-viewer';
import { usePlanUpdates } from '@/hooks/use-websocket';
import { generateMockCSVViewer } from '@/hooks/use-prompt';
import { PromptResponse, Plan, GeneratedApp } from '@/types';

export default function Home() {
  const [currentPrompt, setCurrentPrompt] = useState<PromptResponse | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [generatedApp, setGeneratedApp] = useState<GeneratedApp | null>(null);
  const [appUrl, setAppUrl] = useState<string | undefined>();

  const { currentStep } = usePlanUpdates(currentPrompt?.planId || '');

  const handlePromptSubmitted = (response: PromptResponse) => {
    setCurrentPrompt(response);
    
    // Create a mock plan
    const mockPlan: Plan = {
      id: response.planId || 'mock-plan-id',
      promptId: response.id,
      steps: [
        {
          id: 'step-1',
          type: 'perception',
          description: 'Analyze prompt to understand UI requirements',
          status: 'completed'
        },
        {
          id: 'step-2',
          type: 'synthesis',
          description: 'Generate application code',
          status: 'completed'
        },
        {
          id: 'step-3',
          type: 'execution',
          description: 'Execute application in sandbox',
          status: 'completed'
        },
        {
          id: 'step-4',
          type: 'validation',
          description: 'Validate and test application',
          status: 'completed'
        }
      ],
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setPlan(mockPlan);

    // Generate mock app based on prompt
    setTimeout(() => {
      const mockApp = generateMockCSVViewer();
      setGeneratedApp(mockApp);
      setAppUrl('/csv-demo'); // Mock URL for the generated app
    }, 1000);
  };

  return (
    <main className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold">Imagine Platform</h1>
        <p className="text-lg text-gray-600">
          Transform natural language into runnable applications
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <PromptInput onPromptSubmitted={handlePromptSubmitted} />
          
          {plan && (
            <PlanViewer plan={plan} currentStep={currentStep} />
          )}
        </div>

        <div className="space-y-6">
          {generatedApp && (
            <AppViewer app={generatedApp} appUrl={appUrl} />
          )}
          
          {!generatedApp && (
            <div className="text-center text-gray-500 p-12 border-2 border-dashed border-gray-300 rounded-lg">
              <div className="text-lg font-medium mb-2">No Application Yet</div>
              <div>Submit a prompt to generate your first application</div>
              <div className="mt-4 text-sm">
                Try: "CSV viewer with filter and export"
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}