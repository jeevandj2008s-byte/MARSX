import React, { useState, useRef, useEffect } from "react";
import { ChatMessage, MapContext } from "./types";
import { streamChat } from "./api";

interface ChatWindowProps {
  context?: MapContext;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ context }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "model",
      content:
        "Mars Walk Guide online. Telemetry locked. Standing by for EVA checklist verification, hazard checks, and terrain safety queries.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  // Clean up streaming on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current();
      }
    };
  }, []);

  const handleSend = (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isStreaming) return;

    setError(null);
    setInput("");

    // Append user message
    const updatedHistory: ChatMessage[] = [
      ...messages,
      { role: "user", content: query },
    ];
    setMessages(updatedHistory);

    // Prepare placeholder for model response
    const modelMessageIndex = updatedHistory.length;
    setMessages((prev) => [...prev, { role: "model", content: "" }]);
    setIsStreaming(true);

    let accumulatedText = "";

    const cancelFn = streamChat({
      message: query,
      history: updatedHistory.slice(0, -1),
      mapContext: context,
      onChunk: (chunk: string) => {
        accumulatedText += chunk;
        setMessages((prev) => {
          const next = [...prev];
          if (next[modelMessageIndex]) {
            next[modelMessageIndex] = {
              role: "model",
              content: accumulatedText,
            };
          }
          return next;
        });
      },
      onError: (err: Error) => {
        setIsStreaming(false);
        setError(`Transmission failed: ${err.message}`);
      },
      onDone: () => {
        setIsStreaming(false);
        abortRef.current = null;
      },
    });

    abortRef.current = cancelFn;
  };

  const quickPrompts = [
    "Check slope hazards along route",
    "Calculate O2 budget for 3.8km walk",
    "Comms relay window status",
    "Identify high-value science targets",
  ];

  return (
    <div className="flex flex-col h-[560px] bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
      {/* Telemetry Status Bar */}
      <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-slate-300 font-semibold">
            EVA TACTICAL GUIDE // RELAY ACTIVE
          </span>
        </div>
        <div className="text-[11px] text-slate-400">
          Target:{" "}
          <strong className="text-cyan-400">
            {context?.location?.site_name || "Jezero Crater"}
          </strong>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
        {messages.map((msg, idx) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={idx}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-400 font-mono">
                <span>{isUser ? "👤 ASTRONAUT" : "🤖 MARS GUIDE"}</span>
              </div>
              <div
                className={`max-w-[88%] p-3.5 rounded-xl leading-relaxed whitespace-pre-wrap border ${
                  isUser
                    ? "bg-cyan-600/20 text-cyan-100 border-cyan-500/40 rounded-br-none"
                    : "bg-slate-950/80 text-slate-200 border-slate-800 rounded-bl-none shadow-md"
                }`}
              >
                {msg.content || (
                  <span className="italic text-slate-500 flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                    Transmitting orbital analysis...
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {error && (
          <div className="p-2.5 bg-rose-950/40 border border-rose-800/60 rounded text-rose-300 text-xs">
            ⚠️ {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Chips */}
      <div className="px-3 py-2 bg-slate-950/80 border-t border-slate-800/70 flex gap-2 overflow-x-auto no-scrollbar">
        {quickPrompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSend(prompt)}
            disabled={isStreaming}
            className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-slate-500 transition-all disabled:opacity-40"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={isStreaming}
          placeholder="Ask Mars Walk Guide (e.g., 'What is our slope limit on route?')..."
          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={() => {
              if (abortRef.current) abortRef.current();
              setIsStreaming(false);
            }}
            className="px-3.5 py-2 bg-rose-600/80 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold tracking-wide transition-all"
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold tracking-wide transition-all disabled:opacity-40"
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
};
