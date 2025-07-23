'use client';

import React, { useState, ReactNode } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import { 
  Loader2, 
  Copy, 
  CopyCheck, 
  User,
  Bot,
  Activity,
  Search,
  Brain,
  Pen,
  ChevronDown,
  ChevronUp,
  Link
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface ProcessedEvent {
  title: string;
  data: any;
}

interface Message {
  id: string;
  type: 'human' | 'ai';
  content: string;
  agent?: string;
  timestamp: Date;
}

// Markdown component props type
type MdComponentProps = {
  className?: string;
  children?: ReactNode;
  [key: string]: any;
};

// Markdown components
const mdComponents = {
  h1: ({ className, children, ...props }: MdComponentProps) => (
    <h1 className={cn("text-2xl font-bold mt-4 mb-2", className)} {...props}>
      {children}
    </h1>
  ),
  h2: ({ className, children, ...props }: MdComponentProps) => (
    <h2 className={cn("text-xl font-bold mt-3 mb-2", className)} {...props}>
      {children}
    </h2>
  ),
  h3: ({ className, children, ...props }: MdComponentProps) => (
    <h3 className={cn("text-lg font-bold mt-3 mb-1", className)} {...props}>
      {children}
    </h3>
  ),
  p: ({ className, children, ...props }: MdComponentProps) => (
    <p className={cn("mb-3 leading-7", className)} {...props}>
      {children}
    </p>
  ),
  ul: ({ className, children, ...props }: MdComponentProps) => (
    <ul className={cn("list-disc pl-6 mb-3", className)} {...props}>
      {children}
    </ul>
  ),
  ol: ({ className, children, ...props }: MdComponentProps) => (
    <ol className={cn("list-decimal pl-6 mb-3", className)} {...props}>
      {children}
    </ol>
  ),
  li: ({ className, children, ...props }: MdComponentProps) => (
    <li className={cn("mb-1", className)} {...props}>
      {children}
    </li>
  ),
  code: ({ className, children, ...props }: MdComponentProps) => (
    <code
      className={cn(
        "bg-neutral-900 rounded px-1 py-0.5 font-mono text-xs",
        className
      )}
      {...props}
    >
      {children}
    </code>
  ),
  pre: ({ className, children, ...props }: MdComponentProps) => (
    <pre
      className={cn(
        "bg-neutral-900 p-3 rounded-lg overflow-x-auto font-mono text-xs my-3",
        className
      )}
      {...props}
    >
      {children}
    </pre>
  ),
};

// ActivityTimeline Component
interface ActivityTimelineProps {
  processedEvents: ProcessedEvent[];
  isLoading: boolean;
  websiteCount: number;
}

function ActivityTimeline({ processedEvents, isLoading, websiteCount }: ActivityTimelineProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const formatEventData = (data: any): string => {
    // Handle new structured data types
    if (typeof data === "object" && data !== null && data.type) {
      switch (data.type) {
        case 'functionCall':
          return `Calling function: ${data.name}\nArguments: ${JSON.stringify(data.args, null, 2)}`;
        case 'functionResponse':
          return `Function ${data.name} response:\n${JSON.stringify(data.response, null, 2)}`;
        case 'text':
          return data.content;
        case 'sources':
          const sources = data.content as Record<string, { title: string; url: string }>;
          if (Object.keys(sources).length === 0) {
            return "No sources found.";
          }
          return Object.values(sources)
            .map(source => `[${source.title || 'Untitled Source'}](${source.url})`).join(', ');
        default:
          return JSON.stringify(data, null, 2);
      }
    }
    
    // Existing logic for backward compatibility
    if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return data;
      }
    } else if (Array.isArray(data)) {
      return data.join(", ");
    } else if (typeof data === "object" && data !== null) {
      return JSON.stringify(data, null, 2);
    }
    return String(data);
  };

  const isJsonData = (data: any): boolean => {
    if (typeof data === "object" && data !== null && data.type) {
      if (data.type === 'sources') {
        return false; // Let ReactMarkdown handle this
      }
      return data.type === 'functionCall' || data.type === 'functionResponse';
    }
    
    if (typeof data === "string") {
      try {
        JSON.parse(data);
        return true;
      } catch {
        return false;
      }
    }
    return typeof data === "object" && data !== null;
  };

  const getEventIcon = (title: string) => {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes("function call")) {
      return <Activity className="h-3 w-3 text-blue-400" />;
    } else if (lowerTitle.includes("function response")) {
      return <Activity className="h-3 w-3 text-green-400" />;
    } else if (lowerTitle.includes("search") || lowerTitle.includes("research")) {
      return <Search className="h-3 w-3 text-neutral-400" />;
    } else if (lowerTitle.includes("thinking") || lowerTitle.includes("planning")) {
      return <Brain className="h-3 w-3 text-neutral-400" />;
    } else if (lowerTitle.includes("writing") || lowerTitle.includes("composing")) {
      return <Pen className="h-3 w-3 text-neutral-400" />;
    } else if (lowerTitle.includes("source") || lowerTitle.includes("link")) {
      return <Link className="h-3 w-3 text-yellow-400" />;
    }
    return <Activity className="h-3 w-3 text-neutral-400" />;
  };

  return (
    <Card className={`border-border bg-card ${isCollapsed ? "h-10" : "max-h-96"}`}>
      <CardHeader className="py-2">
        <CardDescription className="flex items-center justify-between">
          <div
            className="flex items-center justify-start text-sm w-full cursor-pointer gap-2"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <span>Research</span>
            {websiteCount > 0 && (
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                {websiteCount} websites
              </span>
            )}
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </div>
        </CardDescription>
      </CardHeader>
      {!isCollapsed && (
        <ScrollArea className="max-h-80">
          <CardContent className="pt-0">
            {isLoading && processedEvents.length === 0 && (
              <div className="relative pl-8 pb-4">
                <div className="absolute left-3 top-3.5 h-full w-0.5 bg-border" />
                <div className="absolute left-0.5 top-2 h-5 w-5 rounded-full bg-background border flex items-center justify-center">
                  <Loader2 className="h-3 w-3 animate-spin" />
                </div>
                <p className="text-sm font-medium">Thinking...</p>
              </div>
            )}
            {processedEvents.map((event, index) => (
              <div key={index} className="relative pl-8 pb-4">
                {index < processedEvents.length - 1 && (
                  <div className="absolute left-3 top-3.5 h-full w-0.5 bg-border" />
                )}
                <div className="absolute left-0.5 top-2 h-5 w-5 rounded-full bg-background border flex items-center justify-center">
                  {getEventIcon(event.title)}
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">{event.title}</p>
                  {event.data && (
                    <div className="text-xs text-muted-foreground">
                      {isJsonData(event.data) ? (
                        <pre className="bg-neutral-800 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                          {formatEventData(event.data)}
                        </pre>
                      ) : (
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <span>{children}</span>,
                            a: ({ href, children }) => (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 underline"
                              >
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {formatEventData(event.data)}
                        </ReactMarkdown>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && processedEvents.length > 0 && (
              <div className="relative pl-8 pb-4">
                <div className="absolute left-0.5 top-2 h-5 w-5 rounded-full bg-background border flex items-center justify-center">
                  <Loader2 className="h-3 w-3 animate-spin" />
                </div>
                <p className="text-sm font-medium">Processing...</p>
              </div>
            )}
          </CardContent>
        </ScrollArea>
      )}
    </Card>
  );
}

// HumanMessageBubble Component
interface HumanMessageBubbleProps {
  message: Message;
}

function HumanMessageBubble({ message }: HumanMessageBubbleProps) {
  return (
    <div className="flex justify-end">
      <div className="bg-neutral-700 text-white rounded-3xl rounded-br-lg px-4 py-3 max-w-[90%] break-words">
        <ReactMarkdown components={mdComponents} remarkPlugins={[remarkGfm]}>
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

// AiMessageBubble Component
interface AiMessageBubbleProps {
  message: Message;
  processedEvents: ProcessedEvent[];
  websiteCount: number;
  isLoading: boolean;
  isLastMessage: boolean;
}

function AiMessageBubble({ 
  message, 
  processedEvents, 
  websiteCount, 
  isLoading, 
  isLastMessage 
}: AiMessageBubbleProps) {
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const handleCopy = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  const shouldShowTimeline = processedEvents.length > 0 || (isLoading && isLastMessage);
  const shouldDisplayDirectly = 
    message.agent === "interactive_planner_agent" || 
    message.agent === "report_composer_with_citations";

  return (
    <div className="flex justify-start">
      <div className="flex-1 space-y-2 max-w-4xl">
        {/* Show timeline if we have events or are loading */}
        {shouldShowTimeline && (
          <ActivityTimeline 
            processedEvents={processedEvents}
            isLoading={isLoading && isLastMessage}
            websiteCount={isLastMessage ? websiteCount : 0}
          />
        )}
        
        {/* Show content if we have any content, regardless of agent type */}
        {message.content && message.content.trim() && (
          <div className="relative break-words flex flex-col w-full">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <ReactMarkdown components={mdComponents} remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
              <button
                onClick={() => handleCopy(message.content, message.id)}
                className="p-1 hover:bg-neutral-700 rounded"
              >
                {copiedMessageId === message.id ? (
                  <CopyCheck className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 text-neutral-400" />
                )}
              </button>
            </div>
            {message.agent && (
              <p className="text-xs text-neutral-400 mt-2">
                Agent: {message.agent}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Main ChatMessagesView Component
interface ADKChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  scrollAreaRef: React.RefObject<HTMLDivElement>;
  messageEvents: Map<string, ProcessedEvent[]>;
  websiteCount: number;
}

export function ADKChatMessages({ 
  messages, 
  isLoading, 
  scrollAreaRef, 
  messageEvents, 
  websiteCount 
}: ADKChatMessagesProps) {
  // Find the last AI message
  const lastAiMessage = messages.slice().reverse().find(m => m.type === "ai");
  const lastAiMessageId = lastAiMessage?.id;

  return (
    <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
      <div className="space-y-4 max-w-4xl mx-auto">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            <Bot className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-semibold">Welcome to ADK Research Assistant</p>
            <p className="text-sm">
              Ask me anything and I'll research it for you using web search and AI agents.
            </p>
          </div>
        )}
        
        {messages.map((message) => {
          const eventsForMessage = message.type === "ai" ? (messageEvents.get(message.id) || []) : [];
          const isLastAiMessage = message.type === "ai" && message.id === lastAiMessageId;

          return (
            <div key={message.id}>
              {message.type === "human" ? (
                <HumanMessageBubble message={message} />
              ) : (
                <AiMessageBubble
                  message={message}
                  processedEvents={eventsForMessage}
                  websiteCount={websiteCount}
                  isLoading={isLoading}
                  isLastMessage={isLastAiMessage}
                />
              )}
            </div>
          );
        })}
        
        {/* Show thinking indicator if we're loading and last message is human */}
        {isLoading && messages.length > 0 && messages[messages.length - 1].type === 'human' && (
          <div className="flex gap-3 justify-start">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Thinking...</span>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
} 