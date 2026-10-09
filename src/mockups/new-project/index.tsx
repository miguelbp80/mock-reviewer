import { Link, Route, Switch } from "wouter";
import type { MockupMeta } from "../../mockups";
import "./styles.css";

// New project workspace. Build the mockup here; scope CSS under .np.
export const meta: MockupMeta = {
  id: "new-project-j8ya7y7r",
  title: "New project",
};

const Nav = () => (
  <header className="np-nav" data-anchor="nav">
    <strong>Bonus Homes</strong>
    <nav>
      <Link href="/">Home</Link>
      <Link href="/pricing">Pricing</Link>
    </nav>
  </header>
);

const Home = () => (
  <>
    <section className="np-hero" data-anchor="hero">
      <h1>Sell your home on your terms.</h1>
      <p>Compare every option side by side and pick the one that leaves you with the most.</p>
      <form className="np-form" data-anchor="hero-form" onSubmit={(e) => e.preventDefault()}>
        <input placeholder="Enter your home address" aria-label="Home address" />
        <button type="submit">Get started</button>
      </form>
    </section>
    <section className="np-grid">
      {["Cash offer", "List with an agent", "Keep and rent"].map((t) => (
        <article key={t} data-anchor={`option-${t.toLowerCase().replace(/\s+/g, "-")}`}>
          <h2>{t}</h2>
          <p>Short description of this option and who it is best for.</p>
        </article>
      ))}
    </section>
  </>
);

const Pricing = () => (
  <section className="np-hero" data-anchor="pricing-hero">
    <h1>Simple pricing.</h1>
    <p>One flat fee, paid at closing. No surprises.</p>
    <div className="np-grid">
      <article data-anchor="pricing-standard">
        <h2>Standard</h2>
        <p className="np-price">1.5%</p>
      </article>
      <article data-anchor="pricing-full-service">
        <h2>Full service</h2>
        <p className="np-price">2.5%</p>
      </article>
    </div>
  </section>
);

const SampleLanding = () => (
  <div className="np">
    <Nav />
    <Switch>
      <Route path="/pricing" component={Pricing} />
      <Route component={Home} />
    </Switch>
  </div>
);

export default SampleLanding;
