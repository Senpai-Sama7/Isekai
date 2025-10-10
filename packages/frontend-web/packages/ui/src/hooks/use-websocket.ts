'use client';

import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { WebSocketMessage, Plan, PlanStep } from '@imagine/types';

export function useWebSocket(url: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);

  useEffect(() => {
    const newSocket = io(url, {
      transports: ['websocket'],
      upgrade: false
    });

    newSocket.on('connect', () => {
      setConnected(true);
      console.log('Connected to WebSocket server');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      console.log('Disconnected from WebSocket server');
    });

    newSocket.on('message', (message: WebSocketMessage) => {
      setMessages(prev => [...prev, message]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [url]);

  const sendMessage = (message: any) => {
    if (socket && connected) {
      socket.emit('message', message);
    }
  };

  return {
    socket,
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
    // Listen for plan-related messages
    messages.forEach(message => {
      switch (message.type) {
        case 'step_started':
          if (message.data.planId === planId) {
            setCurrentStep({
              id: message.data.stepId,
              type: message.data.type,
              description: '',
              status: 'in_progress',
              startedAt: message.timestamp
            });
          }
          break;
        
        case 'step_completed':
          if (message.data.planId === planId) {
            setCurrentStep(prev => prev ? {
              ...prev,
              status: 'completed',
              completedAt: message.timestamp,
              duration: message.data.duration,
              output: message.data.output
            } : null);
          }
          break;
        
        case 'plan_completed':
          if (message.data.planId === planId) {
            setPlan(prev => prev ? { ...prev, status: 'completed' } : null);
          }
          break;
        
        case 'plan_failed':
          if (message.data.planId === planId) {
            setPlan(prev => prev ? { ...prev, status: 'failed' } : null);
          }
          break;
      }
    });
  }, [messages, planId]);

  return { plan, currentStep };
}