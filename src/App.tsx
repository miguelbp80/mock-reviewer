import { useEffect, useState, type FormEvent } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import { findMockup, mockups } from "./mockups";
import CommentLayer from "./comments/CommentLayer";

const MockupView = ({ id }: { id: string }) => {
  // Inside the nested route, the location is relative to /m/<id>.
  const [path] = useLocation();
  const mockup = findMockup(id);
  if (!mockup) return <NotFound />;
  return (
    <CommentLayer mockupId={mockup.id} path={path || "/"}>
      <mockup.Component />
    </CommentLayer>
  );
};

const NotFound = () => (
  <main className="mr-page">
    <h1>Mockup not found</h1>
    <p>Check the link you were given.</p>
  </main>
);

// The index is private: the route list shows only after the admin key is
// accepted by /api/admin. Reviewers get one link at a time.
const KEY_STORAGE = "mr-admin-key";

const readKey = () => {
  try {
    return sessionStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
};

const checkKey = async (key: string) => {
  const res = await fetch("/api/admin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key }),
  });
  return res.ok ? null : ((await res.json().catch(() => ({}))).error ?? "Could not check the key");
};

const Home = () => {
  const [unlocked, setUnlocked] = useState(import.meta.env.DEV);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = readKey();
    if (saved) checkKey(saved).then((err) => setUnlocked(err === null));
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const key = String(new FormData(event.currentTarget).get("key") ?? "");
    const err = await checkKey(key);
    setError(err);
    if (err === null) {
      try {
        sessionStorage.setItem(KEY_STORAGE, key);
      } catch {
        // Private mode: the key just won't be remembered.
      }
      setUnlocked(true);
    }
  };

  return (
    <main className="mr-page">
      <h1>Mockup Review</h1>
      {unlocked ? (
        <>
          <h2>Mockups</h2>
          <ul>
            {mockups.map((m) => (
              <li key={m.id}>
                <Link href={`/m/${m.id}`}>{m.title}</Link> <code>/m/{m.id}</code>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p>Open the link you were given to view a mockup and leave comments.</p>
          <form onSubmit={submit}>
            <label htmlFor="admin-key">Admin key</label>
            <input id="admin-key" name="key" type="password" autoComplete="off" required />
            <button type="submit">Show mockups</button>
            {error && <p role="alert">{error}</p>}
          </form>
        </>
      )}
    </main>
  );
};

const App = () => (
  <Switch>
    <Route path="/m/:id" nest>
      {(params) => <MockupView id={params.id} />}
    </Route>
    <Route path="/" component={Home} />
    <Route component={NotFound} />
  </Switch>
);

export default App;
