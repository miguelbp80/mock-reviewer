import { Link, Route, Switch } from "wouter";
import type { MockupMeta } from "../../mockups";
import "./styles.css";

// Example mockup. Copy this folder to start a new one and change the id
// (keep a random suffix so the link can't be guessed).
export const meta: MockupMeta = {
  id: "sample-landing-k7f3q9x2",
  title: "Sample landing page",
};

const Nav = () => (
  <header className="sl-nav">
    <strong>Acme Homes</strong>
    <nav>
      <Link href="/">Home</Link>
      <Link href="/pricing">Pricing</Link>
    </nav>
  </header>
);

const Home = () => (
  <>
    <section className="sl-hero">
      <h1>Sell your home on your terms.</h1>
      <p>Compare every option side by side and pick the one that leaves you with the most.</p>
      <form className="sl-form" onSubmit={(e) => e.preventDefault()}>
        <input placeholder="Enter your home address" aria-label="Home address" />
        <button type="submit">Get started</button>
      </form>
    </section>
    <section className="sl-grid">
      {["Cash offer", "List with an agent", "Keep and rent"].map((t) => (
        <article key={t}>
          <h2>{t}</h2>
          <p>Short description of this option and who it is best for.</p>
        </article>
      ))}
    </section>
  </>
);

const Pricing = () => (
  <section className="sl-hero">
    <h1>Simple pricing.</h1>
    <p>One flat fee, paid at closing. No surprises.</p>
    <div className="sl-grid">
      <article>
        <h2>Standard</h2>
        <p className="sl-price">1.5%</p>
      </article>
      <article>
        <h2>Full service</h2>
        <p className="sl-price">2.5%</p>
      </article>
    </div>
  </section>
);

const SampleLanding = () => (
  <div className="sl">
    <Nav />
    <Switch>
      <Route path="/pricing" component={Pricing} />
      <Route component={Home} />
    </Switch>
  </div>
);

export default SampleLanding;
