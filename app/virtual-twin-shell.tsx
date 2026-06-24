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
  conversation_token?: string;
  voice_id?: string;
  dynamic_variables: DynamicVariables;
};

type ConnectionOverlay = "name" | "loading" | "success" | null;

const initialMessages: Message[] = [
  {
    id: 1,
    role: "twin",
    text: "Hi, I am Martin's virtual twin. Once connected, I can discuss Martin's work, projects, values, and perspectives.",
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
  const pendingOutboundMessageRef = useRef<string | null>(null);
  const [introHidden, setIntroHidden] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(true);
  const [messages, setMessages] = useState(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [pendingVisitorName, setPendingVisitorName] = useState("");
  const [connectionOverlay, setConnectionOverlay] = useState<ConnectionOverlay>(null);
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
    onConnect: () => {
      setConnectionNote("Connected");
      setConnectionOverlay("success");
      if (pendingOutboundMessageRef.current) {
        conversation.sendUserActivity();
        conversation.sendUserMessage(pendingOutboundMessageRef.current);
        pendingOutboundMessageRef.current = null;
      }
      window.setTimeout(() => setConnectionOverlay(null), 1600);
    },
    onDisconnect: () => {
      setConnectionNote("Ready");
    },
    onError: (message) => {
      setConnectionNote("Needs attention");
      appendMessage("twin", `Connection issue: ${message}`);
    },
    onDebug: (event) => {
      if (event && typeof event === "object" && "type" in event && event.type === "error") {
        appendMessage("twin", "ElevenLabs returned an error while processing the message.");
      }
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
    if (!visitorName) {
      setConnectionOverlay("name");
    }
    if (window.innerWidth >= 1100) {
      setHistoryCollapsed(false);
    }
    window.setTimeout(() => {
      if (visitorName) {
        inputRef.current?.focus();
      }
    }, 280);
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

  async function getSessionConfig(name: string): Promise<SessionResponse> {
    const response = await fetch("/api/elevenlabs/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ mode: "socialization", visitorName: name }),
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

  async function startVoiceConversation(name = visitorName) {
    const cleanName = name.trim();

    if (!cleanName) {
      setConnectionOverlay("name");
      return;
    }

    setConnectionNote("Connecting");
    setConnectionOverlay("loading");

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
      });

      const {
        agent_id: agentId,
        conversation_token: conversationToken,
        voice_id: voiceId,
        dynamic_variables: dynamicVariables,
      } = await getSessionConfig(cleanName);

      const sessionOptions = {
        userId: "martin-public-visitor",
        dynamicVariables,
        overrides: voiceId
          ? {
              tts: {
                voiceId,
              },
            }
          : undefined,
      };

      if (conversationToken) {
        conversation.startSession({
          conversationToken,
          ...sessionOptions,
        });
      } else {
        conversation.startSession({
          agentId,
          ...sessionOptions,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start voice conversation.";
      setConnectionNote("Needs attention");
      setConnectionOverlay("name");
      appendMessage("twin", message);
    }
  }

  async function toggleVoiceConversation() {
    if (isConnected || isConnecting) {
      conversation.endSession();
      setConnectionNote("Ready");
      return;
    }

    if (!visitorName) {
      setConnectionOverlay("name");
      return;
    }

    await startVoiceConversation();
  }

  async function submitVisitorName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanName = pendingVisitorName.trim();
    if (!cleanName) {
      return;
    }

    setVisitorName(cleanName);
    await startVoiceConversation(cleanName);
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = inputValue.trim();
    if (!text) {
      return;
    }

    if (!isConnected) {
      if (!visitorName) {
        setConnectionOverlay("name");
        return;
      }

      localUserMessageRef.current = text;
      pendingOutboundMessageRef.current = text;
      appendMessage("visitor", text);
      setInputValue("");

      if (!isConnecting) {
        await startVoiceConversation();
      }

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

      {introHidden && connectionOverlay ? (
        <section className="connection-overlay" aria-live="polite">
          {connectionOverlay === "name" ? (
            <form className="connection-card" onSubmit={submitVisitorName}>
              <p className="connection-eyebrow">Before We Start</p>
              <h2>What should Martin&apos;s Twin call you?</h2>
              <input
                autoFocus
                type="text"
                value={pendingVisitorName}
                onChange={(event) => setPendingVisitorName(event.target.value)}
                placeholder="Your name"
                maxLength={80}
              />
              <button type="submit" disabled={!pendingVisitorName.trim()}>
                Start Conversation
              </button>
            </form>
          ) : null}

          {connectionOverlay === "loading" ? (
            <div className="connection-card connection-card-status">
              <span className="loading-ring" aria-hidden="true" />
              <h2>Connecting to Martin&apos;s Twin</h2>
              <p>Setting up the voice conversation for {visitorName || pendingVisitorName}.</p>
            </div>
          ) : null}

          {connectionOverlay === "success" ? (
            <div className="connection-card connection-card-status">
              <span className="success-mark" aria-hidden="true" />
              <h2>Connected</h2>
              <p>{visitorName}, you can speak or type now.</p>
            </div>
          ) : null}
        </section>
      ) : null}

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
              <span>{message.role === "visitor" ? visitorName || "Visitor" : "Martin's Twin"}</span>
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
        <button className="send-button" type="submit" aria-label="Send message" disabled={!inputValue.trim()}>
          Send
        </button>
      </form>
    </main>
  );
}
