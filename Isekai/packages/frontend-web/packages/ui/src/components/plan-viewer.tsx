'use client';

import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Plan, PlanStep } from '@imagine/types';
import { formatDuration, formatTimestamp, getStatusColor, getStepIcon } from '@/lib/utils';

interface PlanViewerProps {
  plan: Plan | null;
  currentStep: PlanStep | null;
}

export function PlanViewer({ plan, currentStep }: PlanViewerProps) {
  if (!plan) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            No plan in progress. Submit a prompt to get started.
          </div>
        </CardContent>
      </Card>
    );
  }

  const completedSteps = plan.steps.filter(step => step.status === 'completed').length;
  const progress = (completedSteps / plan.steps.length) * 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Execution Plan</CardTitle>
          <Badge variant={plan.status === 'completed' ? 'default' : 'secondary'}>
            {plan.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Progress</span>
            <span>{completedSteps}/{plan.steps.length} steps</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>

        <div className="space-y-3">
          {plan.steps.map((step, index) => (
            <StepCard 
              key={step.id} 
              step={step} 
              isCurrent={currentStep?.id === step.id}
              index={index}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface StepCardProps {
  step: PlanStep;
  isCurrent: boolean;
  index: number;
}

function StepCard({ step, isCurrent, index }: StepCardProps) {
  const statusColor = getStatusColor(step.status);
  
  return (
    <div className={`border rounded-lg p-3 ${isCurrent ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{getStepIcon(step.type)}</span>
          <span className="text-sm font-medium">Step {index + 1}</span>
        </div>
        
        <div className="flex-1">
          <div className="font-medium">{step.description}</div>
          <div className={`text-sm ${statusColor}`}>
            {step.status}
            {step.duration && ` • ${formatDuration(step.duration)}`}
            {step.startedAt && ` • ${formatTimestamp(step.startedAt)}`}
          </div>
        </div>

        {step.status === 'in_progress' && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        )}
        
        {step.status === 'completed' && (
          <div className="text-green-500">✓</div>
        )}
        
        {step.status === 'failed' && (
          <div className="text-red-500">✗</div>
        )}
      </div>

      {step.error && (
        <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
          {step.error}
        </div>
      )}

      {step.output && (
        <details className="mt-2">
          <summary className="text-sm text-gray-600 cursor-pointer">Output</summary>
          <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
            {JSON.stringify(step.output, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}