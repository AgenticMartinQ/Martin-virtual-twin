"use client";

import { FormEvent, useRef, useState } from "react";

type Message = {
  id: number;
  role: "twin" | "visitor";
  text: string;
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [introHidden, setIntroHidden] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(true);
  const [messages, setMessages] = useState(initialMessages);
  const [inputValue, setInputValue] = useState("");

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

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = inputValue.trim();
    if (!text) {
      return;
    }

    setMessages((current) => [
      ...current,
      { id: Date.now(), role: "visitor", text },
      {
        id: Date.now() + 1,
        role: "twin",
        text: "This is a design draft response. In the next build step, this area will stream the real ElevenLabs conversation.",
      },
    ]);
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
          <span className="status-dot">Ready</span>
        </div>
        <div id="transcript" className="transcript" aria-live="polite">
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
        <button className="mic-button" type="button" aria-label="Start voice conversation">
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
            onChange={(event) => setInputValue(event.target.value)}
          />
        </label>
        <button className="send-button" type="submit" aria-label="Send message">
          Send
        </button>
      </form>
    </main>
  );
}
