import { auth } from '@/app/(auth)/auth';
import { ChatSDKError } from '@/lib/errors';

// ADK FastAPI server configuration
const ADK_BASE_URL = process.env.ADK_BASE_URL || 'http://localhost:8000';

interface ADKMessage {
  parts: { text: string }[];
  role: string;
}

interface ADKRequest {
  appName: string;
  userId: string;
  sessionId: string;
  newMessage: ADKMessage;
  streaming: boolean;
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const body = await request.json();
    const { appName, userId, sessionId, newMessage, streaming } = body;

    if (!appName || !userId || !sessionId || !newMessage) {
      return new ChatSDKError('bad_request:api').toResponse();
    }

    // Prepare ADK request - matching gemini-fullstack pattern
    const adkRequest: ADKRequest = {
      appName,
      userId,
      sessionId,
      newMessage,
      streaming: streaming ?? false
    };

    // Send request to ADK FastAPI server
    const adkResponse = await fetch(`${ADK_BASE_URL}/run_sse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(adkRequest),
    });

    if (!adkResponse.ok) {
      throw new Error(`ADK server error: ${adkResponse.status} ${adkResponse.statusText}`);
    }

    // Return streaming response
    return new Response(adkResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('ADK chat error:', error);
    return new ChatSDKError('bad_request:api').toResponse();
  }
} 