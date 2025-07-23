# ADK Integration with Next.js Chat

This document explains how to set up and use the Google ADK (Agent Development Kit) integration with the Next.js chat application.

## Overview

The ADK integration provides a research assistant powered by Google's ADK, which can perform web searches, analyze information, and provide detailed responses with citations. This is separate from the regular chat functionality and provides enhanced research capabilities.

## Setup

### 1. Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
# ADK FastAPI server configuration
ADK_BASE_URL=http://localhost:8000
ADK_APP_NAME=app

# Google Cloud/API configuration (for ADK)
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=global
GOOGLE_GENAI_USE_VERTEXAI=True
# OR for AI Studio:
# GOOGLE_GENAI_USE_VERTEXAI=False
# GOOGLE_API_KEY=your-api-key
```

### 2. Start the ADK FastAPI Server

The ADK server needs to be running for the integration to work. You can start it using the gemini-fullstack app:

```bash
# Navigate to the gemini-fullstack directory
cd gemini-fullstack

# Install dependencies (if not already done)
pip install -r requirements.txt

# Start the ADK server
python -m google.adk.cli.fast_api --agents-dir . --web
```

The server will start on `http://localhost:8000` by default.

### 3. Verify ADK Backend Health

The Next.js app will automatically check if the ADK backend is available. You can also manually check by visiting:

```
http://localhost:3000/api/adk/health
```

## Usage

### Accessing the ADK Chat

1. Start your Next.js development server:
   ```bash
   pnpm dev
   ```

2. Navigate to the chat application and sign in

3. Click the bot icon (🤖) in the sidebar to access the ADK Research Assistant

4. The ADK chat interface will appear with a welcome message

### Features

- **Real-time Streaming**: Responses are streamed in real-time as the ADK agents work
- **Research Capabilities**: The ADK can perform web searches and analyze information
- **Agent Information**: Each response shows which ADK agent processed the request
- **Session Management**: Conversations are maintained in ADK sessions

### Example Queries

Try asking the ADK Research Assistant questions like:

- "What are the latest developments in AI research?"
- "Research the current state of renewable energy adoption"
- "What are the main challenges in quantum computing?"
- "Find information about recent space exploration missions"

## Architecture

### API Routes

- `/api/adk/chat` (POST): Send messages to ADK and receive streaming responses
- `/api/adk/session` (POST): Create ADK sessions
- `/api/adk/health` (GET): Check ADK backend health

### Components

- `ADKChat`: Main chat interface component
- `app/(chat)/adk/page.tsx`: ADK chat page
- `app/(chat)/api/adk/chat/route.ts`: ADK chat API
- `app/(chat)/api/adk/session/route.ts`: ADK session API
- `app/(chat)/api/adk/health/route.ts`: ADK health check API

### Communication Flow

1. **Session Creation**: When the ADK chat loads, it creates a new ADK session
2. **Message Sending**: User messages are sent to the ADK FastAPI server
3. **Streaming Response**: ADK processes the message and streams events back
4. **Real-time Updates**: The UI updates in real-time as events are received

## Troubleshooting

### ADK Backend Not Available

If you see "ADK Backend Unavailable":

1. Ensure the ADK FastAPI server is running on `http://localhost:8000`
2. Check that the `ADK_BASE_URL` environment variable is correct
3. Verify the ADK server is accessible by visiting `http://localhost:8000/api/list-apps`

### Connection Issues

- Check that both the Next.js app and ADK server are running
- Verify network connectivity between the services
- Check browser console for any error messages

### Authentication Issues

- Ensure you're signed in to the Next.js application
- Check that the ADK server has proper authentication configured

## Development

### Adding New Features

To extend the ADK integration:

1. **New API Endpoints**: Add routes in `app/(chat)/api/adk/`
2. **UI Components**: Extend the `ADKChat` component
3. **ADK Agents**: Modify the ADK agent configuration in the gemini-fullstack directory

### Customizing ADK Agents

The ADK agents are defined in `gemini-fullstack/app/agent.py`. You can:

- Modify agent behavior
- Add new tools and capabilities
- Customize the research process
- Add new structured output models

## Security Considerations

- The ADK server should be properly secured in production
- Consider using environment variables for sensitive configuration
- Implement proper rate limiting and authentication
- Monitor API usage and costs

## Performance

- The ADK integration uses streaming responses for better user experience
- Sessions are maintained to preserve conversation context
- Consider implementing caching for frequently requested information
- Monitor response times and optimize as needed 