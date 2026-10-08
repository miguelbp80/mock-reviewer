import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent, MouseEvent, ReactNode } from "react";
import { createComment, listThreads, setStatus, type Comment, type Thread } from "./api";

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

/** Where a pin is drawn, inside the stage: x in % of its width, y in px. */
type Pos = { leftPct: number; top: number; approx: boolean };

/** A pin about to be saved. Anchor fields are set when the click was on a data-anchor element. */
type Spot = {
  x_pct: number;
  y_px: number;
  anchor?: string;
  anchor_x_pct?: number;
  anchor_y_pct?: number;
};

/** Opens to the right of the pin, or to the left near the right edge. */
const popoverStyle = (spot: { x_pct: number; y_px: number }) =>
  spot.x_pct > 60
    ? { right: `calc(${100 - spot.x_pct}% + 18px)`, top: spot.y_px - 12 }
    : { left: `calc(${spot.x_pct}% + 18px)`, top: spot.y_px - 12 };

/* ── Anchors: pins that follow an element instead of fixed coordinates ── */

const isVisible = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

/** The visible element in the stage marked data-anchor="<name>". */
const findAnchor = (stage: HTMLElement, name: string) => {
  for (const el of stage.querySelectorAll<HTMLElement>("[data-anchor]")) {
    if (el.dataset.anchor === name && isVisible(el)) return el;
  }
  return null;
};

/** The nearest data-anchor element under a viewport point, inside the stage. */
const anchorAt = (stage: HTMLElement, x: number, y: number) => {
  for (const el of document.elementsFromPoint(x, y)) {
    const anchor = el.closest<HTMLElement>("[data-anchor]");
    if (anchor && stage.contains(anchor) && isVisible(anchor)) return anchor;
  }
  return null;
};

/**
 * Position of a saved comment in the current layout. Anchored pins follow
 * their element at the saved offset. If the element is missing or hidden at
 * this width, the pin falls back to its saved coordinates and is marked approx.
 */
const resolvePos = (c: Comment, stage: HTMLElement): Pos => {
  const fallback: Pos = { leftPct: c.x_pct ?? 0, top: c.y_px ?? 0, approx: false };
  if (!c.anchor || c.anchor_x_pct == null || c.anchor_y_pct == null) return fallback;

  const el = findAnchor(stage, c.anchor);
  if (!el) return { ...fallback, approx: true };

  const s = stage.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const x = r.left - s.left + (c.anchor_x_pct / 100) * r.width;
  const y = r.top - s.top + (c.anchor_y_pct / 100) * r.height;
  return { leftPct: (x / s.width) * 100, top: y, approx: false };
};

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
  pos,
  mockupId,
  path,
  onChange,
  onClose,
}: {
  thread: Thread;
  pos: Pos;
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
      style={popoverStyle({ x_pct: pos.leftPct, y_px: pos.top })}
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
 * Wraps a mockup page. In comment mode a click anywhere drops a pin. If the
 * click lands inside an element marked data-anchor, the pin is attached to
 * that element; otherwise it is stored by coordinates (x as % of the page
 * width, y in px from the top). Pins are repositioned when the layout changes.
 */
const CommentLayer = ({ mockupId, path, children }: { mockupId: string; path: string; children: ReactNode }) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [positions, setPositions] = useState<Record<string, Pos>>({});
  const [layoutTick, setLayoutTick] = useState(0);
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

  // The stage changes size when the viewport or the mockup's layout changes.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => setLayoutTick((n) => n + 1));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  // Re-place every pin before paint, so anchored pins never flash in the wrong place.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const next: Record<string, Pos> = {};
    for (const t of threads) next[t.id] = resolvePos(t, stage);
    setPositions(next);
  }, [threads, layoutTick]);

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
    const stage = stageRef.current!;
    const rect = stage.getBoundingClientRect();
    setOpenId(null);

    const spot: Spot = {
      x_pct: Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)),
      y_px: Math.max(0, e.clientY - rect.top),
    };

    const anchor = anchorAt(stage, e.clientX, e.clientY);
    if (anchor) {
      const r = anchor.getBoundingClientRect();
      const clamp = (v: number) => Math.min(100, Math.max(0, v));
      spot.anchor = anchor.dataset.anchor;
      spot.anchor_x_pct = clamp(((e.clientX - r.left) / r.width) * 100);
      spot.anchor_y_pct = clamp(((e.clientY - r.top) / r.height) * 100);
    }
    setDraft(spot);
  };

  const posOf = (t: Comment): Pos => positions[t.id] ?? { leftPct: t.x_pct ?? 0, top: t.y_px ?? 0, approx: false };

  const visible = threads.filter((t) => showResolved || t.status === "open" || t.id === openId);
  const openThread = threads.find((t) => t.id === openId);
  const openCount = threads.filter((t) => t.status === "open").length;
  const resolvedCount = threads.length - openCount;

  return (
    <>
      <div ref={stageRef} className={`mr-stage${commenting ? " is-commenting" : ""}`}>
        {children}

        {commenting && <div className="mr-capture" onClick={placePin} aria-hidden="true" />}

        {visible.map((t) => {
          const pos = posOf(t);
          const resolved = t.status === "resolved";
          return (
            <button
              key={t.id}
              type="button"
              className={`mr-pin${resolved ? " is-resolved" : ""}${t.id === openId ? " is-open" : ""}${pos.approx ? " is-approx" : ""}`}
              style={{ left: `${pos.leftPct}%`, top: pos.top }}
              title={pos.approx ? "Approximate position: the element this comment is attached to is not shown at this width" : undefined}
              aria-label={`Comment ${t.number} by ${t.author}${resolved ? ", resolved" : ""}${pos.approx ? ", approximate position" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setDraft(null);
                setOpenId(t.id === openId ? null : t.id);
              }}
            >
              {t.number}
            </button>
          );
        })}

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
                    ...(draft.anchor
                      ? { anchor: draft.anchor, anchor_x_pct: draft.anchor_x_pct, anchor_y_pct: draft.anchor_y_pct }
                      : {}),
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
          <ThreadCard
            thread={openThread}
            pos={posOf(openThread)}
            mockupId={mockupId}
            path={path}
            onChange={load}
            onClose={() => setOpenId(null)}
          />
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
