import { auth } from '@/app/(auth)/auth';
import { ChatSDKError } from '@/lib/errors';

// ADK FastAPI server configuration
const ADK_BASE_URL = process.env.ADK_BASE_URL || 'http://localhost:8000';

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const { sessionId } = await request.json();

    if (!sessionId) {
      return new ChatSDKError('bad_request:api').toResponse();
    }

    // Create session in ADK - matching gemini-fullstack pattern
    const sessionResponse = await fetch(`${ADK_BASE_URL}/apps/app/users/u_999/sessions/${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!sessionResponse.ok) {
      throw new Error(`Failed to create ADK session: ${sessionResponse.status} ${sessionResponse.statusText}`);
    }

    const sessionData = await sessionResponse.json();

    // Return in the same format as gemini-fullstack
    return Response.json({
      id: sessionData.id,
      userId: sessionData.userId,
      appName: sessionData.appName,
      events: sessionData.events || [],
      state: sessionData.state || {}
    });

  } catch (error) {
    console.error('ADK session creation error:', error);
    return new ChatSDKError('bad_request:api').toResponse();
  }
} 