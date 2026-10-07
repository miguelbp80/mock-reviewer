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

// The index is private on purpose: links are shared one by one. The list
// only shows in development.
const Home = () => (
  <main className="mr-page">
    <h1>Mockup Review</h1>
    <p>Open the link you were given to view a mockup and leave comments.</p>
    {import.meta.env.DEV && (
      <>
        <h2>Mockups (dev only)</h2>
        <ul>
          {mockups.map((m) => (
            <li key={m.id}>
              <Link href={`/m/${m.id}`}>{m.title}</Link> <code>/m/{m.id}</code>
            </li>
          ))}
        </ul>
      </>
    )}
  </main>
);

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
