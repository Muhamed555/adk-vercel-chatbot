import { ChatSDKError } from '@/lib/errors';

// ADK FastAPI server configuration
const ADK_BASE_URL = process.env.ADK_BASE_URL || 'http://localhost:8000';

export async function GET() {
  console.log('=== ADK Health Check Started ===');
  console.log(`ADK_BASE_URL: ${ADK_BASE_URL}`);
          console.log(`Full URL: ${ADK_BASE_URL}/list-apps`);
    
    try {
      console.log(`Checking ADK backend health at: ${ADK_BASE_URL}/list-apps`);
      
      // Check if ADK server is running by calling the list-apps endpoint
            const response = await fetch(`${ADK_BASE_URL}/list-apps`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

    console.log(`ADK health check response status: ${response.status}`);

    if (response.ok) {
      try {
        const data = await response.json();
        console.log(`ADK health check successful, available apps:`, data);
        return Response.json({ 
          status: 'healthy', 
          message: 'ADK backend is running',
          apps: data 
        });
      } catch (e) {
        // If response is not JSON, just return healthy status
        console.log(`ADK health check successful (non-JSON response)`);
        return Response.json({ 
          status: 'healthy', 
          message: 'ADK backend is running'
        });
      }
    } else {
      const errorText = await response.text();
      console.error(`ADK health check failed with status ${response.status}:`, errorText);
      return Response.json(
        { 
          status: 'unhealthy', 
          message: `ADK backend is not responding properly (${response.status})`,
          error: errorText
        },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('ADK health check failed with exception:', error);
    return Response.json(
      { 
        status: 'unhealthy', 
        message: 'ADK backend is not accessible',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    );
  }
} 