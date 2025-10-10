'use client';

import { useState, useEffect } from 'react';
import { WebSocketMessage, Plan, PlanStep } from '@/types';

export function useWebSocket(url: string) {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);

  useEffect(() => {
    // Simulate WebSocket connection for now
    setConnected(true);
    
    // Simulate receiving messages
    const interval = setInterval(() => {
      const mockMessage: WebSocketMessage = {
        type: 'heartbeat',
        data: { timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev.slice(-10), mockMessage]);
    }, 5000);

    return () => clearInterval(interval);
  }, [url]);

  const sendMessage = (message: any) => {
    // Simulate sending message
    console.log('Sending message:', message);
  };

  return {
    socket: null,
    connected,
    messages,
    sendMessage
  };
}

export function usePlanUpdates(planId: string) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [currentStep, setCurrentStep] = useState<PlanStep | null>(null);
  const { messages } = useWebSocket('ws://localhost:3003');

  useEffect(() => {
    // Simulate plan updates for now
    if (planId && plan) {
      const interval = setInterval(() => {
        setPlan(prev => {
          if (!prev) return null;
          
          const nextStepIndex = prev.steps.findIndex(step => step.status === 'pending');
          if (nextStepIndex === -1) return prev;
          
          const updatedSteps = [...prev.steps];
          updatedSteps[nextStepIndex] = {
            ...updatedSteps[nextStepIndex],
            status: 'in_progress',
            startedAt: new Date().toISOString()
          };
          
          return { ...prev, steps: updatedSteps };
        });
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [planId, plan]);

  return { plan, currentStep };
}