'use client';

import { useState } from 'react';
import { PromptInput } from '@/components/prompt-input';
import { PlanViewer } from '@/components/plan-viewer';
import { AppViewer } from '@/components/app-viewer';
import { usePlanUpdates } from '@/hooks/use-websocket';
import { PromptResponse, Plan, GeneratedApp } from '@imagine/types';

export default function Home() {
  const [currentPrompt, setCurrentPrompt] = useState<PromptResponse | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [generatedApp, setGeneratedApp] = useState<GeneratedApp | null>(null);
  const [appUrl, setAppUrl] = useState<string | undefined>();

  const { currentStep } = usePlanUpdates(currentPrompt?.planId || '');

  const handlePromptSubmitted = (response: PromptResponse) => {
    setCurrentPrompt(response);
    
    // In a real implementation, we would fetch the plan details
    // For now, we'll create a mock plan
    const mockPlan: Plan = {
      id: response.planId || 'mock-plan-id',
      promptId: response.id,
      steps: [
        {
          id: 'step-1',
          type: 'perception',
          description: 'Analyze prompt to understand UI requirements',
          status: 'pending'
        },
        {
          id: 'step-2',
          type: 'synthesis',
          description: 'Generate application code',
          status: 'pending'
        },
        {
          id: 'step-3',
          type: 'execution',
          description: 'Execute application in sandbox',
          status: 'pending'
        },
        {
          id: 'step-4',
          type: 'validation',
          description: 'Validate and test application',
          status: 'pending'
        }
      ],
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setPlan(mockPlan);
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
            </div>
          )}
        </div>
      </div>
    </main>
  );
}