import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, MouseEvent, ReactNode } from "react";
import { createComment, listThreads, setStatus, type Thread } from "./api";

const AUTHOR_KEY = "mr-author";

const readAuthor = () => {
  try {
    return localStorage.getItem(AUTHOR_KEY) ?? "";
  } catch {
    return "";
  }
};
const saveAuthor = (name: string) => {
  try {
    localStorage.setItem(AUTHOR_KEY, name);
  } catch {
    /* private mode: ask again next time */
  }
};

const timeAgo = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
};

type Spot = { x_pct: number; y_px: number };

/** Opens to the right of the pin, or to the left near the right edge. */
const popoverStyle = (spot: Spot) =>
  spot.x_pct > 60
    ? { right: `calc(${100 - spot.x_pct}% + 18px)`, top: spot.y_px - 12 }
    : { left: `calc(${spot.x_pct}% + 18px)`, top: spot.y_px - 12 };

/* ── Composer: one form for new pins and replies ─────────────────────── */

const Composer = ({
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
  autoFocus,
}: {
  placeholder: string;
  submitLabel: string;
  onSubmit: (author: string, body: string) => Promise<void>;
  onCancel?: () => void;
  autoFocus?: boolean;
}) => {
  const [author, setAuthor] = useState(readAuthor);
  const [knownAuthor] = useState(() => Boolean(readAuthor()));
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!author.trim() || !body.trim()) {
      setError(!author.trim() ? "Add your name." : "Write a comment.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      saveAuthor(author.trim());
      await onSubmit(author.trim(), body.trim());
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="mr-composer" onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && onCancel?.()}>
      {!knownAuthor && (
        <input
          className="mr-input"
          placeholder="Your name"
          aria-label="Your name"
          value={author}
          maxLength={60}
          onChange={(e) => setAuthor(e.target.value)}
          autoFocus={autoFocus}
        />
      )}
      <textarea
        className="mr-input"
        placeholder={placeholder}
        aria-label={placeholder}
        value={body}
        maxLength={2000}
        rows={3}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
        }}
        autoFocus={autoFocus && knownAuthor}
      />
      {error && (
        <p className="mr-error" role="alert">
          {error}
        </p>
      )}
      <div className="mr-actions">
        {onCancel && (
          <button type="button" className="mr-btn mr-btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="mr-btn" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
};

/* ── Thread card ─────────────────────────────────────────────────────── */

const ThreadCard = ({
  thread,
  mockupId,
  path,
  onChange,
  onClose,
}: {
  thread: Thread;
  mockupId: string;
  path: string;
  onChange: () => Promise<void>;
  onClose: () => void;
}) => {
  const resolved = thread.status === "resolved";
  const toggle = async () => {
    await setStatus(thread.id, resolved ? "open" : "resolved");
    await onChange();
    if (!resolved) onClose();
  };

  return (
    <div
      className="mr-card"
      role="dialog"
      aria-label={`Comment ${thread.number}`}
      style={popoverStyle({ x_pct: thread.x_pct ?? 0, y_px: thread.y_px ?? 0 })}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mr-card__head">
        <span className="mr-card__title">#{thread.number}{resolved && " · Resolved"}</span>
        <button type="button" className="mr-btn mr-btn--ghost mr-btn--small" onClick={toggle}>
          {resolved ? "Reopen" : "Resolve"}
        </button>
        <button type="button" className="mr-icon" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <ol className="mr-messages">
        {[thread, ...thread.replies].map((c) => (
          <li key={c.id}>
            <p className="mr-meta">
              <strong>{c.author}</strong> · {timeAgo(c.created_at)}
            </p>
            <p className="mr-body">{c.body}</p>
          </li>
        ))}
      </ol>
      <Composer
        placeholder="Reply"
        submitLabel="Reply"
        onSubmit={async (author, body) => {
          await createComment({ mockup: mockupId, path, author, body, parent_id: thread.id });
          await onChange();
        }}
      />
    </div>
  );
};

/* ── Layer ───────────────────────────────────────────────────────────── */

/**
 * Wraps a mockup page. In comment mode a click anywhere drops a pin at that
 * point: x as % of the page width, y in px from the top, plus the route.
 */
const CommentLayer = ({ mockupId, path, children }: { mockupId: string; path: string; children: ReactNode }) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [commenting, setCommenting] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [draft, setDraft] = useState<Spot | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    try {
      setThreads(await listThreads(mockupId, path));
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load comments.");
    }
  }, [mockupId, path]);

  useEffect(() => {
    setDraft(null);
    setOpenId(null);
    load();
  }, [load]);

  // C toggles comment mode, Esc closes whatever is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest("input, textarea, [contenteditable]");
      if (e.key === "Escape") {
        if (draft) setDraft(null);
        else if (openId) setOpenId(null);
        else setCommenting(false);
      } else if (!typing && (e.key === "c" || e.key === "C") && !e.metaKey && !e.ctrlKey) {
        setCommenting((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft, openId]);

  const placePin = (e: MouseEvent<HTMLDivElement>) => {
    const rect = stageRef.current!.getBoundingClientRect();
    setOpenId(null);
    setDraft({
      x_pct: Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)),
      y_px: Math.max(0, e.clientY - rect.top),
    });
  };

  const visible = threads.filter((t) => showResolved || t.status === "open" || t.id === openId);
  const openThread = threads.find((t) => t.id === openId);
  const openCount = threads.filter((t) => t.status === "open").length;
  const resolvedCount = threads.length - openCount;

  return (
    <>
      <div ref={stageRef} className={`mr-stage${commenting ? " is-commenting" : ""}`}>
        {children}

        {commenting && <div className="mr-capture" onClick={placePin} aria-hidden="true" />}

        {visible.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`mr-pin${t.status === "resolved" ? " is-resolved" : ""}${t.id === openId ? " is-open" : ""}`}
            style={{ left: `${t.x_pct}%`, top: t.y_px ?? 0 }}
            aria-label={`Comment ${t.number} by ${t.author}${t.status === "resolved" ? ", resolved" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setDraft(null);
              setOpenId(t.id === openId ? null : t.id);
            }}
          >
            {t.number}
          </button>
        ))}

        {draft && (
          <>
            <span className="mr-pin is-draft" style={{ left: `${draft.x_pct}%`, top: draft.y_px }} aria-hidden="true">
              +
            </span>
            <div className="mr-card" style={popoverStyle(draft)} onClick={(e) => e.stopPropagation()}>
              <Composer
                autoFocus
                placeholder="Add a comment"
                submitLabel="Comment"
                onCancel={() => setDraft(null)}
                onSubmit={async (author, body) => {
                  const { id } = await createComment({
                    mockup: mockupId,
                    path,
                    author,
                    body,
                    x_pct: draft.x_pct,
                    y_px: draft.y_px,
                    page_width: stageRef.current?.clientWidth ?? window.innerWidth,
                  });
                  setDraft(null);
                  await load();
                  setOpenId(id);
                }}
              />
            </div>
          </>
        )}

        {openThread && (
          <ThreadCard thread={openThread} mockupId={mockupId} path={path} onChange={load} onClose={() => setOpenId(null)} />
        )}
      </div>

      <div className="mr-toolbar" role="toolbar" aria-label="Comments">
        <button
          type="button"
          className={`mr-btn${commenting ? "" : " mr-btn--ghost"}`}
          aria-pressed={commenting}
          onClick={() => setCommenting((v) => !v)}
          title="Press C"
        >
          {commenting ? "Click anywhere to comment" : "Comment"}
        </button>
        <span className="mr-count">{openCount} open</span>
        {resolvedCount > 0 && (
          <label className="mr-toggle">
            <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
            Show resolved ({resolvedCount})
          </label>
        )}
        {loadError && (
          <span className="mr-error" role="alert">
            {loadError}
          </span>
        )}
      </div>
    </>
  );
};

export default CommentLayer;
