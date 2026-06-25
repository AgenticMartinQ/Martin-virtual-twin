"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Message = {
  id: number;
  role: "twin" | "visitor";
  text: string;
};

type DynamicVariables = Record<string, string | number | boolean>;

type SessionResponse = {
  agent_id: string;
  conversation_token?: string;
  database_conversation_id?: string;
  voice_id?: string;
  dynamic_variables: DynamicVariables;
};

type ConnectionOverlay = "name" | "loading" | "success" | null;

type Interest = {
  title: string;
  detail: string;
  date: string;
  sourceUrl?: string;
};

const fallbackInterests: Interest[] = [
  {
    title: "Agentic AI for financial services",
    detail: "Martin may be watching how autonomous workflows can improve banking operations, advisory productivity, and risk controls.",
    date: "Latest",
  },
  {
    title: "Virtual twin memory design",
    detail: "Martin may see memory design as the foundation for making virtual agents more representative and trustworthy.",
    date: "This week",
  },
  {
    title: "RAG quality and hallucination control",
    detail: "Martin may care about retrieval quality because grounded answers matter more than fluent guesses.",
    date: "This week",
  },
  {
    title: "Leadership in AI transformation",
    detail: "How managers can redesign decision-making, talent models, and execution rhythms around AI.",
    date: "Recent",
  },
  {
    title: "Capital markets technology",
    detail: "Where automation, data platforms, and workflow intelligence can change front-office productivity.",
    date: "Recent",
  },
  {
    title: "Personal knowledge systems",
    detail: "Building durable ways to capture career stories, values, project lessons, and management philosophy.",
    date: "Earlier",
  },
];

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
  const connectionWarningShownRef = useRef(false);
  const isConnectedRef = useRef(false);
  const endSessionRef = useRef<() => void>(() => undefined);
  const databaseConversationIdRef = useRef("");
  const conversationEndedRef = useRef(false);
  const logQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [introHidden, setIntroHidden] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [interestsCollapsed, setInterestsCollapsed] = useState(true);
  const [messages, setMessages] = useState(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [pendingVisitorName, setPendingVisitorName] = useState("");
  const [connectionOverlay, setConnectionOverlay] = useState<ConnectionOverlay>(null);
  const [connectionNote, setConnectionNote] = useState("Ready");
  const [connectionStarted, setConnectionStarted] = useState(false);
  const [databaseConversationId, setDatabaseConversationId] = useState("");
  const [recentInterests, setRecentInterests] = useState<Interest[]>(fallbackInterests);
  const [adminPortalOpen, setAdminPortalOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

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
      connectionWarningShownRef.current = false;
      if (pendingOutboundMessageRef.current) {
        conversation.sendUserActivity();
        conversation.sendUserMessage(pendingOutboundMessageRef.current);
        pendingOutboundMessageRef.current = null;
      }
      window.setTimeout(() => setConnectionOverlay(null), 1600);
    },
    onDisconnect: () => {
      setConnectionNote("Ended");
      markConversationEnded();
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
        logConversationTurn("visitor", message);
        return;
      }

      appendMessage("twin", message);
      logConversationTurn("twin", message);
    },
  });

  const isConnected = conversation.status === "connected";
  const isConnecting = conversation.status === "connecting";

  useEffect(() => {
    isConnectedRef.current = isConnected;
    endSessionRef.current = conversation.endSession;
  }, [conversation.endSession, isConnected]);

  useEffect(() => {
    databaseConversationIdRef.current = databaseConversationId;
  }, [databaseConversationId]);

  useEffect(() => {
    let isMounted = true;

    async function loadDailyInterests() {
      try {
        const response = await fetch("/api/interests", {
          cache: "no-store",
        });
        const data = (await response.json()) as { interests?: Interest[] };

        if (isMounted && Array.isArray(data.interests) && data.interests.length > 0) {
          setRecentInterests(data.interests);
        }
      } catch {
        if (isMounted) {
          setRecentInterests(fallbackInterests);
        }
      }
    }

    void loadDailyInterests();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    function endActiveSession() {
      if (isConnectedRef.current) {
        beaconConversationEnded();
        endSessionRef.current();
      }
    }

    window.addEventListener("pagehide", endActiveSession);
    window.addEventListener("beforeunload", endActiveSession);

    return () => {
      window.removeEventListener("pagehide", endActiveSession);
      window.removeEventListener("beforeunload", endActiveSession);
    };
  }, []);

  function estimateSessionTokens(currentMessages: Message[]) {
    const conversationText = currentMessages
      .filter((message) => message.id !== 1 && message.id !== 3)
      .map((message) => message.text)
      .join("\n");

    if (!conversationText.trim()) {
      return 0;
    }

    return Math.max(1, Math.ceil(conversationText.length / 4));
  }

  function getExitMessage() {
    const estimatedTokens = estimateSessionTokens(messages);
    const tokenText = estimatedTokens > 0 ? `about ${estimatedTokens.toLocaleString()} text tokens` : "a very small number of text tokens";

    return `Thanks for chatting with Martin's Twin. This session used ${tokenText} based on the visible conversation text. If this experience was useful, would you like to sponsor HK$1 to help cover token costs and support further development?`;
  }

  function logConversationTurn(role: Message["role"], text: string) {
    const conversationId = databaseConversationIdRef.current;

    if (!conversationId) {
      return Promise.resolve();
    }

    logQueueRef.current = logQueueRef.current
      .catch(() => undefined)
      .then(() =>
        fetch("/api/conversations/log", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            conversationId,
            role,
            text,
          }),
          keepalive: true,
        }).then(() => undefined)
      )
      .catch(() => undefined);

    return logQueueRef.current;
  }

  function beaconConversationEnded() {
    const conversationId = databaseConversationIdRef.current;

    if (!conversationId || conversationEndedRef.current) {
      return;
    }

    conversationEndedRef.current = true;
    const body = JSON.stringify({ conversationId });

    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/conversations/end", new Blob([body], { type: "application/json" }));
      return;
    }

    void fetch("/api/conversations/end", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body,
      keepalive: true,
    }).catch(() => undefined);
  }

  function markConversationEnded() {
    const conversationId = databaseConversationIdRef.current;

    if (!conversationId || conversationEndedRef.current) {
      return;
    }

    conversationEndedRef.current = true;
    void fetch("/api/conversations/end", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ conversationId }),
      keepalive: true,
    }).catch(() => undefined);
  }

  function revealConversation() {
    setIntroHidden(true);
    if (!visitorName) {
      setConnectionOverlay("name");
    }
    if (window.innerWidth >= 1100) {
      setInterestsCollapsed(false);
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
      const errorData = (await response.json().catch(() => null)) as { error?: unknown } | null;
      const detail = typeof errorData?.error === "string" ? errorData.error : "Unable to prepare the ElevenLabs session.";
      throw new Error(detail);
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

    if (isConnected || isConnecting || connectionStarted) {
      return;
    }

    setConnectionStarted(true);
    setConnectionNote("Connecting");
    setConnectionOverlay("loading");

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
      });

      const {
        agent_id: agentId,
        conversation_token: conversationToken,
        database_conversation_id: newDatabaseConversationId,
        voice_id: voiceId,
        dynamic_variables: dynamicVariables,
      } = await getSessionConfig(cleanName);

      setDatabaseConversationId(newDatabaseConversationId ?? "");
      databaseConversationIdRef.current = newDatabaseConversationId ?? "";
      conversationEndedRef.current = false;

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
      setConnectionOverlay(null);
      appendMessage("twin", message);
    }
  }

  function toggleVoiceInput() {
    if (isConnected) {
      conversation.setMuted(!conversation.isMuted);
      return;
    }

    if (!visitorName) {
      setConnectionOverlay("name");
      return;
    }

    if (!connectionWarningShownRef.current) {
      connectionWarningShownRef.current = true;
      appendMessage("twin", "The ElevenLabs connection is not ready yet. Please wait for the connection to complete before using voice input.");
    }
  }

  async function exitChat() {
    if (!isConnected && !isConnecting) {
      return;
    }

    const exitMessage = getExitMessage();
    appendMessage("twin", exitMessage);
    await logConversationTurn("twin", exitMessage);
    conversation.endSession();
    markConversationEnded();
    setConnectionNote("Ending");
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

      if (isConnecting) {
        localUserMessageRef.current = text;
        pendingOutboundMessageRef.current = text;
        appendMessage("visitor", text);
        logConversationTurn("visitor", text);
        setInputValue("");
        return;
      }

      if (!connectionWarningShownRef.current) {
        connectionWarningShownRef.current = true;
        appendMessage("twin", "The ElevenLabs connection is not ready yet. Please wait for the connection to complete before sending another message.");
      }
      return;
    }

    localUserMessageRef.current = text;
    appendMessage("visitor", text);
    logConversationTurn("visitor", text);
    conversation.sendUserActivity();
    conversation.sendUserMessage(text);
    setInputValue("");
  }

  async function submitAdminPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanPassword = adminPassword.trim();
    if (!cleanPassword) {
      return;
    }

    setAdminLoading(true);
    setAdminError("");

    try {
      const response = await fetch("/api/admin/stats", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ password: cleanPassword }),
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as { error?: unknown } | null;

      if (!response.ok) {
        const detail = typeof data?.error === "string" ? data.error : "Unable to open admin dashboard.";
        throw new Error(detail);
      }

      window.sessionStorage.setItem("martin-admin-password", cleanPassword);
      window.location.href = "/admin";
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Unable to open admin dashboard.");
    } finally {
      setAdminLoading(false);
    }
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

      <button className="admin-entry-button" type="button" onClick={() => setAdminPortalOpen(true)}>
        Admin
      </button>

      {adminPortalOpen ? (
        <section className="admin-portal-overlay" aria-label="Admin dashboard login" aria-modal="true" role="dialog">
          <form className="admin-portal-card" onSubmit={submitAdminPassword}>
            <button
              className="admin-portal-close"
              type="button"
              aria-label="Close admin login"
              onClick={() => {
                setAdminPortalOpen(false);
                setAdminError("");
              }}
            >
              ×
            </button>
            <p className="connection-eyebrow">Admin Portal</p>
            <h2>Open Visitor Dashboard</h2>
            <input
              autoFocus
              type="password"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              placeholder="Admin password"
            />
            <button type="submit" disabled={!adminPassword.trim() || adminLoading}>
              {adminLoading ? "Checking" : "Open Dashboard"}
            </button>
            {adminError ? <p className="admin-portal-error">{adminError}</p> : null}
          </form>
        </section>
      ) : null}

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
              <button type="submit" disabled={!pendingVisitorName.trim() || connectionStarted || isConnecting}>
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

      <details className={`tips-widget${introHidden ? "" : " is-hidden"}`}>
        <summary>
          <img src="/assets/payme-qr.jpg" alt="" aria-hidden="true" />
          <span>
            <small>Tips</small>
            <strong>Scan to support token cost</strong>
          </span>
        </summary>
        <div className="tips-card">
          <p>If this chat was useful, a small PayMe tip helps sponsor the token cost of keeping Martin&apos;s Twin running.</p>
          <img src="/assets/payme-qr.jpg" alt="PayMe QR code for tipping Martin" />
        </div>
      </details>

      <aside
        id="interestsPanel"
        className={`interests-panel${interestsCollapsed ? " is-collapsed" : ""}`}
        aria-label="Martin's recent interests"
      >
        <button
          id="interestsToggle"
          className="panel-toggle"
          type="button"
          aria-label="Toggle Martin's recent interests"
          onClick={() => setInterestsCollapsed((current) => !current)}
        >
          <span className="toggle-mark" aria-hidden="true" />
        </button>
        <div className="panel-content">
          <div className="panel-heading">
            <span>Martin&apos;s Recent Interests</span>
          </div>
          <div className="interest-list" aria-label="Recent interests ranked by recency">
            {recentInterests.map((interest) => (
              <article className="interest-item" key={interest.title}>
                <time>{interest.date}</time>
                <h2>{interest.title}</h2>
                <p>{interest.detail}</p>
              </article>
            ))}
          </div>
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
          className={`mic-button${isConnected ? " is-connected" : ""}${isConnecting ? " is-connecting" : ""}${
            conversation.isMuted ? " is-muted" : ""
          }`}
          type="button"
          aria-label={isConnected ? (conversation.isMuted ? "Unmute microphone" : "Mute microphone") : "Voice connection pending"}
          onClick={toggleVoiceInput}
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
        <button className="exit-button" type="button" aria-label="Exit chat" disabled={!isConnected && !isConnecting} onClick={exitChat}>
          Exit
        </button>
      </form>
    </main>
  );
}
