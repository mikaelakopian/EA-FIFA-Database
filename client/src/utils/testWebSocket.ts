/**
 * WebSocket Connection Test Utility
 * 
 * This utility helps test and debug WebSocket connections
 */

export interface WebSocketTestResult {
  success: boolean;
  connectionTime?: number;
  error?: string;
  readyState?: number;
  messages?: any[];
}

export class WebSocketTester {
  private ws: WebSocket | null = null;
  private messages: any[] = [];
  private startTime: number = 0;

  async testConnection(url: string = 'ws://localhost:8000/ws'): Promise<WebSocketTestResult> {
    return new Promise((resolve) => {
      this.startTime = Date.now();
      this.messages = [];

      try {
        this.ws = new WebSocket(url);

        const timeout = setTimeout(() => {
          this.cleanup();
          resolve({
            success: false,
            error: 'Connection timeout after 10 seconds',
            readyState: this.ws?.readyState
          });
        }, 10000);

        this.ws.onopen = () => {
          const connectionTime = Date.now() - this.startTime;
          console.log(`WebSocket connected in ${connectionTime}ms`);
          
          // Send a test ping
          this.ws?.send(JSON.stringify({ type: 'ping', test: true }));
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.messages.push(data);
            console.log('Received message:', data);

            // If we get a connected message and a pong, test is successful
            if (this.messages.some(m => m.type === 'connected') && 
                this.messages.some(m => m.type === 'pong')) {
              clearTimeout(timeout);
              this.cleanup();
              resolve({
                success: true,
                connectionTime: Date.now() - this.startTime,
                messages: this.messages,
                readyState: WebSocket.OPEN
              });
            }
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          console.error('WebSocket error:', error);
          this.cleanup();
          resolve({
            success: false,
            error: 'WebSocket error occurred',
            readyState: this.ws?.readyState,
            messages: this.messages
          });
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          console.log('WebSocket closed:', event.code, event.reason);
          if (!event.wasClean) {
            resolve({
              success: false,
              error: `Connection closed abnormally: ${event.code} ${event.reason}`,
              readyState: WebSocket.CLOSED,
              messages: this.messages
            });
          }
        };

      } catch (error) {
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          readyState: this.ws?.readyState
        });
      }
    });
  }

  async testReconnection(attempts: number = 3): Promise<WebSocketTestResult[]> {
    const results: WebSocketTestResult[] = [];

    for (let i = 0; i < attempts; i++) {
      console.log(`Testing connection attempt ${i + 1}/${attempts}`);
      const result = await this.testConnection();
      results.push(result);

      if (!result.success && i < attempts - 1) {
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return results;
  }

  private cleanup() {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      if (this.ws.readyState === WebSocket.OPEN || 
          this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  // Static method for quick testing
  static async runDiagnostics(): Promise<void> {
    console.log('=== WebSocket Diagnostics ===');
    console.log('Starting WebSocket connection test...\n');

    const tester = new WebSocketTester();
    
    // Test single connection
    console.log('1. Testing single connection:');
    const singleResult = await tester.testConnection();
    console.log('Result:', singleResult);
    console.log('');

    // Test reconnection
    console.log('2. Testing reconnection (3 attempts):');
    const reconnectResults = await tester.testReconnection(3);
    console.log('Results:', reconnectResults);
    console.log('');

    // Summary
    console.log('=== Summary ===');
    const successCount = reconnectResults.filter(r => r.success).length;
    console.log(`Successful connections: ${successCount}/${reconnectResults.length}`);
    
    if (successCount === 0) {
      console.error('❌ WebSocket connection failed. Please check:');
      console.error('- Is the server running on http://localhost:8000?');
      console.error('- Are there any firewall or network issues?');
      console.error('- Check the browser console for CORS errors');
    } else if (successCount < reconnectResults.length) {
      console.warn('⚠️ WebSocket connection is unstable');
    } else {
      console.log('✅ WebSocket connection is working properly');
    }
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).WebSocketTester = WebSocketTester;
}