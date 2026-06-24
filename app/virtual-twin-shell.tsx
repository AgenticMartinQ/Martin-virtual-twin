"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { FormEvent, useCallback, useRef, useState } from "react";

type Message = {
  id: number;
  role: "twin" | "visitor";
  text: string;
};

type DynamicVariables = Record<string, string | number | boolean>;

type SessionResponse = {
  agent_id: string;
  dynamic_variables: DynamicVariables;
};

const initialMessages: Message[] = [
  {
    id: 1,
    role: "twin",
    text: "Hi, I am Martin's virtual twin. Once connected, I can discuss Martin's work, projects, values, and perspectives.",
  },
  {
    id: 2,
    role: "visitor",
    text: "What should I ask you first?",
  },
  {
    id: 3,
    role: "twin",
    text: "Try asking about a project, a management topic, or a decision Martin has learned from.",
  },
];

export function VirtualTwinShell() {
  return (
    <ConversationProvider>
      <VirtualTwinExperience />
    </ConversationProvider>
  );
}

function VirtualTwinExperience() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const localUserMessageRef = useRef<string | null>(null);
  const [introHidden, setIntroHidden] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(true);
  const [messages, setMessages] = useState(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [connectionNote, setConnectionNote] = useState("Ready");

  const appendMessage = useCallback((role: Message["role"], text: string) => {
    setMessages((current) => [...current, { id: Date.now() + Math.random(), role, text }]);
    window.setTimeout(() => {
      if (transcriptRef.current) {
        transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
      }
    }, 0);
  }, []);

  const conversation = useConversation({
    onConnect: ({ conversationId }) => {
      setConnectionNote("Connected");
      appendMessage("twin", `Connected to Martin's virtual twin. Conversation ID: ${conversationId}`);
    },
    onDisconnect: () => {
      setConnectionNote("Ready");
    },
    onError: (message) => {
      setConnectionNote("Needs attention");
      appendMessage("twin", `Connection issue: ${message}`);
    },
    onMessage: ({ role, message }) => {
      if (!message) {
        return;
      }

      if (role === "user") {
        if (localUserMessageRef.current === message) {
          localUserMessageRef.current = null;
          return;
        }
        appendMessage("visitor", message);
        return;
      }

      appendMessage("twin", message);
    },
  });

  const isConnected = conversation.status === "connected";
  const isConnecting = conversation.status === "connecting";

  function revealConversation() {
    setIntroHidden(true);
    if (window.innerWidth >= 1100) {
      setHistoryCollapsed(false);
    }
    window.setTimeout(() => inputRef.current?.focus(), 280);
  }

  async function toggleIntroVideo() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (video.paused) {
      setIsPlaying(true);

      try {
        video.muted = false;
        await video.play();
      } catch {
        try {
          video.muted = true;
          await video.play();
          setIsPlaying(true);
        } catch {
          setIsPlaying(false);
        }
      }
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }

  function skipIntro() {
    videoRef.current?.pause();
    setIsPlaying(false);
    revealConversation();
  }

  async function getSessionConfig(): Promise<SessionResponse> {
    const response = await fetch("/api/elevenlabs/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ mode: "socialization" }),
    });

    if (!response.ok) {
      throw new Error("Unable to prepare the ElevenLabs session.");
    }

    const data = (await response.json()) as SessionResponse;

    if (!data.agent_id) {
      throw new Error("ElevenLabs agent ID is not configured yet.");
    }

    return data;
  }

  async function startVoiceConversation() {
    setConnectionNote("Connecting");

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
      });

      const { agent_id: agentId, dynamic_variables: dynamicVariables } = await getSessionConfig();

      conversation.startSession({
        agentId,
        userId: "martin-public-visitor",
        dynamicVariables,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start voice conversation.";
      setConnectionNote("Needs attention");
      appendMessage("twin", message);
    }
  }

  async function toggleVoiceConversation() {
    if (isConnected || isConnecting) {
      conversation.endSession();
      setConnectionNote("Ready");
      return;
    }

    await startVoiceConversation();
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = inputValue.trim();
    if (!text) {
      return;
    }

    if (!isConnected) {
      appendMessage("twin", "Start the voice conversation with the microphone button first, then send your message.");
      return;
    }

    localUserMessageRef.current = text;
    appendMessage("visitor", text);
    conversation.sendUserActivity();
    conversation.sendUserMessage(text);
    setInputValue("");
  }

  return (
    <main className="stage" aria-label="Martin Virtual Twin website draft">
      <video
        ref={videoRef}
        id="avatarVideo"
        className="avatar-video"
        src="/assets/HSBC-scene_Welcome.mp4"
        preload="auto"
        playsInline
        onEnded={revealConversation}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <div className="scrim" aria-hidden="true" />

      <section id="introLayer" className={`intro-layer${introHidden ? " is-hidden" : ""}`}>
        <div className="brand-lockup">
          <p className="eyebrow">Martin&apos;s Virtual Twin</p>
          <h1>Talk with a living digital memory.</h1>
        </div>

        <button
          id="videoControl"
          className={`video-control${isPlaying ? " is-playing" : ""}`}
          type="button"
          aria-label={isPlaying ? "Pause introduction video" : "Play introduction video"}
          onClick={toggleIntroVideo}
        >
          <span className={`control-icon ${isPlaying ? "pause-icon" : "play-icon"}`} aria-hidden="true" />
          <span className="control-label">{isPlaying ? "Pause" : "Play"}</span>
        </button>

        <button id="skipIntro" className="skip-button" type="button" onClick={skipIntro}>
          Skip intro
        </button>
      </section>

      <aside
        id="historyPanel"
        className={`history-panel${historyCollapsed ? " is-collapsed" : ""}`}
        aria-label="Historical conversations"
      >
        <button
          id="historyToggle"
          className="panel-toggle"
          type="button"
          aria-label="Toggle historical conversations"
          onClick={() => setHistoryCollapsed((current) => !current)}
        >
          <span className="toggle-mark" aria-hidden="true" />
        </button>
        <div className="panel-content">
          <div className="panel-heading">
            <span>History</span>
            <button className="ghost-icon" type="button" aria-label="Search conversations">
              &#8981;
            </button>
          </div>
          <button className="history-item is-active" type="button">
            <span>Welcome conversation</span>
            <time>Today</time>
          </button>
          <button className="history-item" type="button">
            <span>Career stories</span>
            <time>Draft</time>
          </button>
          <button className="history-item" type="button">
            <span>Leadership philosophy</span>
            <time>Draft</time>
          </button>
        </div>
      </aside>

      <section
        id="conversationPanel"
        className={`conversation-panel${introHidden ? " is-ready" : ""}`}
        aria-label="Streaming conversation"
      >
        <div className="panel-heading">
          <span>Live Conversation</span>
          <span className="status-dot">{connectionNote}</span>
        </div>
        <div id="transcript" className="transcript" aria-live="polite" ref={transcriptRef}>
          {messages.map((message) => (
            <article className={`message ${message.role}`} key={message.id}>
              <span>{message.role === "visitor" ? "Visitor" : "Martin Twin"}</span>
              <p>{message.text}</p>
            </article>
          ))}
        </div>
      </section>

      <form
        id="chatDock"
        className={`chat-dock${introHidden ? "" : " is-hidden"}`}
        aria-label="Chat controls"
        onSubmit={submitMessage}
      >
        <button
          className={`mic-button${isConnected ? " is-connected" : ""}${isConnecting ? " is-connecting" : ""}`}
          type="button"
          aria-label={isConnected || isConnecting ? "End voice conversation" : "Start voice conversation"}
          onClick={toggleVoiceConversation}
        >
          <span aria-hidden="true" />
        </button>
        <label className="chat-input-wrap">
          <span>Message Martin&apos;s virtual twin</span>
          <input
            ref={inputRef}
            id="chatInput"
            type="text"
            autoComplete="off"
            placeholder="Ask about Martin's work, ideas, or experience..."
            value={inputValue}
            onChange={(event) => {
              setInputValue(event.target.value);
              if (isConnected) {
                conversation.sendUserActivity();
              }
            }}
          />
        </label>
        <button className="send-button" type="submit" aria-label="Send message" disabled={!isConnected}>
          Send
        </button>
      </form>
    </main>
  );
}
