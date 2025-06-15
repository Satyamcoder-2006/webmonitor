import { useState, useEffect } from 'react';

interface WebSocketMessage {
  type: string;
  data: any;
}

export function useWebSocket() {
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.hostname}:3001`);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      setLastMessage(event);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  return { lastMessage, isConnected };
} 