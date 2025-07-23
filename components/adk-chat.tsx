'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Session } from 'next-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, Send, Bot } from 'lucide-react';
import { ADKChatMessages } from '@/components/adk-chat-messages';

interface Message {
  id: string;
  type: 'human' | 'ai';
  content: string;
  agent?: string;
  timestamp: Date;
}

interface ProcessedEvent {
  title: string;
  data: any;
}

export function ADKChat({
  id,
  session,
}: {
  id: string;
  session: Session;
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [appName, setAppName] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBackendReady, setIsBackendReady] = useState(false);
  const [isCheckingBackend, setIsCheckingBackend] = useState(true);
  const [messageEvents, setMessageEvents] = useState<Map<string, ProcessedEvent[]>>(new Map());
  const [websiteCount, setWebsiteCount] = useState<number>(0);
  const currentAgentRef = useRef('');
  const accumulatedTextRef = useRef("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Retry with backoff
  const retryWithBackoff = async (
    fn: () => Promise<any>,
    maxRetries: number = 10,
    maxDuration: number = 120000 // 2 minutes
  ): Promise<any> => {
    const startTime = Date.now();
    let lastError: Error;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (Date.now() - startTime > maxDuration) {
        throw new Error(`Retry timeout after ${maxDuration}ms`);
      }
      
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff, max 5s
        console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  };

  // Create session - exactly matching gemini-fullstack
  const createSession = async (): Promise<{userId: string, sessionId: string, appName: string}> => {
    const generatedSessionId = uuidv4();
    const response = await fetch(`/api/adk/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sessionId: generatedSessionId
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return {
      userId: data.userId,
      sessionId: data.id,
      appName: data.appName
    };
  };

  // Check backend health - exactly matching gemini-fullstack
  const checkBackendHealth = async (): Promise<boolean> => {
    try {
      const response = await fetch("/api/adk/health", {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      });
      return response.ok;
    } catch (error) {
      console.log("Backend not ready yet:", error);
      return false;
    }
  };

  // Function to extract text and metadata from SSE data - exactly matching gemini-fullstack
  const extractDataFromSSE = (data: string) => {
    try {
      const parsed = JSON.parse(data);
      console.log('[SSE PARSED EVENT]:', JSON.stringify(parsed, null, 2));

      let textParts: string[] = [];
      let agent = '';
      let finalReportWithCitations = undefined;
      let functionCall = null;
      let functionResponse = null;
      let sources = null;

      // Check if content.parts exists and has text
      if (parsed.content && parsed.content.parts) {
        textParts = parsed.content.parts
          .filter((part: any) => part.text)
          .map((part: any) => part.text);
        
        // Check for function calls
        const functionCallPart = parsed.content.parts.find((part: any) => part.functionCall);
        if (functionCallPart) {
          functionCall = functionCallPart.functionCall;
        }
        
        // Check for function responses
        const functionResponsePart = parsed.content.parts.find((part: any) => part.functionResponse);
        if (functionResponsePart) {
          functionResponse = functionResponsePart.functionResponse;
        }
      }

      // Extract agent information
      if (parsed.author) {
        agent = parsed.author;
      }

      if (
        parsed.actions &&
        parsed.actions.stateDelta &&
        parsed.actions.stateDelta.final_report_with_citations
      ) {
        finalReportWithCitations = parsed.actions.stateDelta.final_report_with_citations;
      }

      // Extract website count from research agents
      let sourceCount = 0;
      if ((parsed.author === 'section_researcher' || parsed.author === 'enhanced_search_executor')) {
        if (parsed.actions?.stateDelta?.url_to_short_id) {
          sourceCount = Object.keys(parsed.actions.stateDelta.url_to_short_id).length;
        }
      }

      // Extract sources if available
      if (parsed.actions?.stateDelta?.sources) {
        sources = parsed.actions.stateDelta.sources;
      }

      return { textParts, agent, finalReportWithCitations, functionCall, functionResponse, sourceCount, sources };
    } catch (error) {
      console.error('Error parsing SSE data:', error);
      return { textParts: [], agent: '', finalReportWithCitations: undefined, functionCall: null, functionResponse: null, sourceCount: 0, sources: null };
    }
  };

  // Function to get event title based on agent - exactly matching gemini-fullstack
  const getEventTitle = (agentName: string): string => {
    switch (agentName) {
      case "plan_generator":
        return "Planning Research Strategy";
      case "section_planner":
        return "Structuring Report Outline";
      case "section_researcher":
        return "Initial Web Research";
      case "research_evaluator":
        return "Evaluating Research Quality";
      case "EscalationChecker":
        return "Quality Assessment";
      case "enhanced_search_executor":
        return "Enhanced Web Research";
      case "research_pipeline":
        return "Executing Research Pipeline";
      case "iterative_refinement_loop":
        return "Refining Research";
      case "interactive_planner_agent":
      case "root_agent":
        return "Interactive Planning";
      default:
        return `Processing (${agentName || 'Unknown Agent'})`;
    }
  };

  // Process SSE event data - exactly matching gemini-fullstack
  const processSseEventData = useCallback((jsonData: string, aiMessageId: string) => {
    const { textParts, agent, finalReportWithCitations, functionCall, functionResponse, sourceCount, sources } = extractDataFromSSE(jsonData);

    if (sourceCount > 0) {
      console.log('[SSE HANDLER] Updating websiteCount. Current sourceCount:', sourceCount);
      setWebsiteCount(prev => Math.max(prev, sourceCount));
    }

    if (agent && agent !== currentAgentRef.current) {
      currentAgentRef.current = agent;
    }

    if (functionCall) {
      const functionCallTitle = `Function Call: ${functionCall.name}`;
      console.log('[SSE HANDLER] Adding Function Call timeline event:', functionCallTitle);
      setMessageEvents(prev => new Map(prev).set(aiMessageId, [...(prev.get(aiMessageId) || []), {
        title: functionCallTitle,
        data: { type: 'functionCall', name: functionCall.name, args: functionCall.args, id: functionCall.id }
      }]));
    }

    if (functionResponse) {
      const functionResponseTitle = `Function Response: ${functionResponse.name}`;
      console.log('[SSE HANDLER] Adding Function Response timeline event:', functionResponseTitle);
      setMessageEvents(prev => new Map(prev).set(aiMessageId, [...(prev.get(aiMessageId) || []), {
        title: functionResponseTitle,
        data: { type: 'functionResponse', name: functionResponse.name, response: functionResponse.response, id: functionResponse.id }
      }]));
    }

    if (textParts.length > 0 && agent !== "report_composer_with_citations") {
      if (agent !== "interactive_planner_agent") {
        const eventTitle = getEventTitle(agent);
        console.log('[SSE HANDLER] Adding Text timeline event for agent:', agent, 'Title:', eventTitle, 'Data:', textParts.join(" "));
        setMessageEvents(prev => new Map(prev).set(aiMessageId, [...(prev.get(aiMessageId) || []), {
          title: eventTitle,
          data: { type: 'text', content: textParts.join(" ") }
        }]));
      } else { // interactive_planner_agent text updates the main AI message
        for (const text of textParts) {
          accumulatedTextRef.current += text + " ";
          console.log('[SSE HANDLER] Updating message content:', accumulatedTextRef.current.trim());
          setMessages(prev => prev.map(msg =>
            msg.id === aiMessageId ? { ...msg, content: accumulatedTextRef.current.trim(), agent: currentAgentRef.current || msg.agent } : msg
          ));
        }
      }
    }

    if (sources) {
      console.log('[SSE HANDLER] Adding Retrieved Sources timeline event:', sources);
      setMessageEvents(prev => new Map(prev).set(aiMessageId, [...(prev.get(aiMessageId) || []), {
        title: "Retrieved Sources", data: { type: 'sources', content: sources }
      }]));
    }

    if (agent === "report_composer_with_citations" && finalReportWithCitations) {
      const finalReportMessageId = Date.now().toString() + "_final";
      setMessages(prev => [...prev, { 
        type: "ai", 
        content: finalReportWithCitations as string, 
        id: finalReportMessageId, 
        agent: currentAgentRef.current, 
        timestamp: new Date()
      }]);
    }

  }, []);

  // Send message - exactly matching gemini-fullstack
  const sendMessage = useCallback(async (query: string) => {
    if (!sessionId || !userId || !appName || !query.trim()) return;

    const userMessageId = uuidv4();
    const aiMessageId = uuidv4();

    // Reset accumulated text for new message
    accumulatedTextRef.current = "";
    currentAgentRef.current = "";

    // Add user message
    setMessages(prev => [...prev, {
      id: userMessageId,
      type: 'human',
      content: query.trim(),
      timestamp: new Date(),
    }]);

    // Create AI message placeholder - exactly matching gemini-fullstack
    setMessages(prev => [...prev, {
      id: aiMessageId,
      type: "ai",
      content: "",
      agent: '',
      timestamp: new Date(),
    }]);

    setIsLoading(true);
    setInput('');

    try {
      const sendMessageRequest = async () => {
        const response = await fetch("/api/adk/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            appName: appName,
            userId: userId,
            sessionId: sessionId,
            newMessage: {
              parts: [{ text: query }],
              role: "user"
            },
            streaming: false
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
        }
        
        return response;
      };

      const response = await retryWithBackoff(sendMessageRequest);

      // Handle SSE streaming - exactly matching gemini-fullstack
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let lineBuffer = ""; 
      let eventDataBuffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();

          if (value) {
            lineBuffer += decoder.decode(value, { stream: true });
          }
          
          let eolIndex;
          while ((eolIndex = lineBuffer.indexOf('\n')) >= 0 || (done && lineBuffer.length > 0)) {
            let line: string;
            if (eolIndex >= 0) {
              line = lineBuffer.substring(0, eolIndex);
              lineBuffer = lineBuffer.substring(eolIndex + 1);
            } else {
              line = lineBuffer;
              lineBuffer = "";
            }

            if (line.trim() === "") {
              if (eventDataBuffer.length > 0) {
                const jsonDataToParse = eventDataBuffer.endsWith('\n') ? eventDataBuffer.slice(0, -1) : eventDataBuffer;
                console.log('[SSE DISPATCH EVENT]:', jsonDataToParse.substring(0, 200) + "...");
                processSseEventData(jsonDataToParse, aiMessageId);
                eventDataBuffer = "";
              }
            } else if (line.startsWith('data:')) {
              eventDataBuffer += line.substring(5).trimStart() + '\n';
            } else if (line.startsWith(':')) {
              // Comment line, ignore
            }
          }

          if (done) {
            if (eventDataBuffer.length > 0) {
              const jsonDataToParse = eventDataBuffer.endsWith('\n') ? eventDataBuffer.slice(0, -1) : eventDataBuffer;
              console.log('[SSE DISPATCH FINAL EVENT]:', jsonDataToParse.substring(0,200) + "...");
              processSseEventData(jsonDataToParse, aiMessageId);
              eventDataBuffer = "";
            }
            break;
          }
        }
      }

      setIsLoading(false);

    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = { 
        id: aiMessageId,
        type: "ai", 
        content: `Sorry, there was an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }
  }, [sessionId, userId, appName, processSseEventData]);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  }, [messages]);

  // Initialize session and check backend - exactly matching gemini-fullstack
  useEffect(() => {
    const checkBackend = async () => {
      setIsCheckingBackend(true);
      
      // Check if backend is ready with retry logic
      const maxAttempts = 60; // 2 minutes with 2-second intervals
      let attempts = 0;
      
      while (attempts < maxAttempts) {
        const isReady = await checkBackendHealth();
        if (isReady) {
          setIsBackendReady(true);
          setIsCheckingBackend(false);
          return;
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between checks
      }
      
      // If we get here, backend didn't come up in time
      setIsCheckingBackend(false);
      console.error("Backend failed to start within 2 minutes");
    };
    
    checkBackend();
  }, []);

  // Create session after backend is ready
  useEffect(() => {
    const initSession = async () => {
      if (!isBackendReady || sessionId) return;
      
      try {
        const sessionData = await retryWithBackoff(createSession);
        setUserId(sessionData.userId);
        setSessionId(sessionData.sessionId);
        setAppName(sessionData.appName);
        console.log("Session created:", sessionData);
      } catch (error) {
        console.error("Failed to create session after retries:", error);
      }
    };
    
    initSession();
  }, [isBackendReady, sessionId]);

  if (isCheckingBackend) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-2 text-sm text-muted-foreground">
            Connecting to ADK backend...
          </p>
        </div>
      </div>
    );
  }

  if (!isBackendReady) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold">ADK Backend Unavailable</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Please ensure the ADK FastAPI server is running on localhost:8000
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <Card className="rounded-none border-b">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            ADK Research Assistant
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Powered by Google ADK with research capabilities
            {websiteCount > 0 && ` • Searched ${websiteCount} websites`}
          </p>
        </CardHeader>
      </Card>

      {/* Messages */}
      <ADKChatMessages
        messages={messages}
        isLoading={isLoading}
        scrollAreaRef={scrollAreaRef}
        messageEvents={messageEvents}
        websiteCount={websiteCount}
      />

      <Separator />

      {/* Input */}
      <div className="p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me to research something..."
            disabled={isLoading || !sessionId}
            className="flex-1"
          />
          <Button 
            type="submit" 
            disabled={isLoading || !input.trim() || !sessionId}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
} 