import React, { useState, useEffect, useRef } from 'react';

const SLIDES = [
  {
    tag: 'Men',
    title: 'Sharp fits for everyday',
    body: 'New season menswear across Level 1.',
    img: 'https://picsum.photos/seed/slide-men/1200/750',
    alt: "Men's clothing rack styled for the new season",
  },
  {
    tag: 'Women',
    title: 'Layer up for the new season',
    body: 'Fresh womenswear drops every week.',
    img: 'https://picsum.photos/seed/slide-women/1200/750',
    alt: "Women's fashion display with seasonal layers",
  },
  {
    tag: 'Kids',
    title: 'Playful picks for little ones',
    body: 'Buy 2 get 1 on kidswear all month.',
    img: 'https://picsum.photos/seed/slide-kids/1200/750',
    alt: "Children's clothing rack with bright colours",
  },
  {
    tag: 'Accessories',
    title: 'Finish the look',
    body: 'Jewellery, scarves, and more on Level 2.',
    img: 'https://picsum.photos/seed/slide-accessories/1200/750',
    alt: 'Accessories counter with jewellery and scarves',
  },
  {
    tag: 'Hand Bags',
    title: 'Structured bags, 20% off',
    body: 'This week only, on Level 2.',
    img: 'https://picsum.photos/seed/slide-bags/1200/750',
    alt: 'Handbags displayed on a boutique shelf',
  },
  {
    tag: 'Footwear',
    title: 'Fresh soles for the season',
    body: 'New arrivals across every store.',
    img: 'https://picsum.photos/seed/slide-footwear/1200/750',
    alt: 'Footwear display with new arrivals',
  },
  {
    tag: 'New arrivals',
    title: 'This week across the mall',
    body: 'Every category, refreshed for the new season.',
    img: 'https://picsum.photos/seed/slide-newarrivals/1200/750',
    alt: 'Storefront highlighting new seasonal arrivals',
  },
];

const PROMOS = [
  {
    title: 'Flat 30% off end-of-season fashion',
    meta: 'Level 1 & 2 · Through Sunday',
    img: 'https://picsum.photos/seed/promo-main/900/1100',
    alt: 'Storefront decorated for a seasonal sale',
    tall: true,
  },
  {
    title: 'Trade in, save more on audio',
    meta: 'Circuit Bazaar · Level 2',
    img: 'https://picsum.photos/seed/promo-tech/700/500',
    alt: 'Electronics store display with new devices',
  },
  {
    title: 'Buy 2 get 1 on kidswear',
    meta: 'Little Field · Level 1',
    img: 'https://picsum.photos/seed/promo-kids/700/500',
    alt: "Children's clothing rack with bright colours",
  },
];

const NAV_LINKS = [
  { label: 'Profile', href: '#profile' },
  { label: 'Offers', href: '#promotions' },
  { label: 'Visit', href: '#visit' },
];

export default function MallHomepage() {
  const [current, setCurrent] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const intervalRef = useRef(null);

  const goTo = (i) => {
    setCurrent(((i % SLIDES.length) + SLIDES.length) % SLIDES.length);
  };

  useEffect(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % SLIDES.length);
    }, 5500);
    return () => clearInterval(intervalRef.current);
  }, [current]);

  return (
    <div className="msq-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Expanded:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

        .msq-root{
          --paper:#FAF6EF;
          --ink:#1C1B29;
          --ink-soft:#4B4A5C;
          --red:#B8452F;
          --gold:#D9A61C;
          --teal:#2E6E62;
          --sand:#EFE7D8;
          --line:#E2D9C6;
          --radius-lg:20px;
          --radius-sm:10px;
          --maxw:min(1800px, 94vw);

          background:var(--paper);
          color:var(--ink);
          font-family:'IBM Plex Sans', sans-serif;
          -webkit-font-smoothing:antialiased;
          min-height:100%;
        }
        .msq-root *{box-sizing:border-box;}
        .msq-root h1,.msq-root h2,.msq-root h3,.msq-root .display{
          font-family:'Archivo Expanded', sans-serif;
          color:var(--ink);
          margin:0;
          letter-spacing:-0.01em;
        }
        .msq-root a{color:inherit;text-decoration:none;}
        .msq-root button{font-family:inherit;cursor:pointer;}
        .msq-root img{display:block;max-width:100%;}
        .msq-wrap{max-width:var(--maxw);margin:0 auto;padding:0 20px;}

        .msq-root a:focus-visible, .msq-root button:focus-visible{
          outline:2px solid var(--teal);
          outline-offset:2px;
        }

        @media (prefers-reduced-motion: reduce){
          .msq-root *{animation-duration:0.01ms !important; transition-duration:0.01ms !important;}
        }

        /* ============ HEADER ============ */
        .msq-header{
          position:sticky;
          top:0;
          z-index:50;
          background:rgba(250,246,239,0.92);
          backdrop-filter:blur(8px);
          border-bottom:1px solid var(--line);
        }
        .msq-header-row{
          display:flex;
          align-items:center;
          justify-content:space-between;
          padding:16px 20px;
          max-width:var(--maxw);
          margin:0 auto;
        }
        .msq-logo{
          display:flex;
          align-items:center;
        }
        .msq-logo img{
          height:34px;
          width:auto;
          display:block;
        }
        .msq-primary-nav{
          display:none;
          gap:28px;
          font-weight:500;
          font-size:0.95rem;
        }
        .msq-primary-nav a{
          padding:4px 0;
          border-bottom:2px solid transparent;
          transition:border-color 0.15s ease;
        }
        .msq-primary-nav a:hover{border-color:var(--gold);}
        .msq-header-actions{
          display:flex;
          align-items:center;
          gap:12px;
        }
        .msq-icon-btn{
          width:40px;height:40px;
          display:flex;align-items:center;justify-content:center;
          border-radius:50%;
          background:var(--sand);
          border:none;
          color:var(--ink);
        }
        .msq-hamburger{
          display:flex;
          background:none;
          border:none;
          padding:8px;
        }
        .msq-hamburger svg{width:24px;height:24px;}

        /* mobile nav drawer */
        .msq-mobile-nav{
          position:fixed;
          inset:0;
          background:var(--paper);
          z-index:60;
          display:none;
          flex-direction:column;
          padding:20px;
        }
        .msq-mobile-nav.open{display:flex;}
        .msq-mobile-nav-top{
          display:flex;justify-content:space-between;align-items:center;
          margin-bottom:32px;
        }
        .msq-mobile-nav a{
          font-family:'Archivo Expanded', sans-serif;
          font-size:1.6rem;
          font-weight:700;
          padding:14px 0;
          border-bottom:1px solid var(--line);
        }
        .msq-mall-info{
          margin-top:auto;
          color:var(--ink-soft);
          font-size:0.9rem;
          line-height:1.6;
        }

        /* ============ HERO ============ */
        .msq-hero-section{
          padding:24px 20px 40px;
          max-width:var(--maxw);
          margin:0 auto;
        }
        .msq-hero-grid{
          display:grid;
          grid-template-columns:1fr;
          gap:16px;
        }
        .msq-carousel{
          position:relative;
          border-radius:var(--radius-lg);
          overflow:hidden;
          aspect-ratio:4/5;
          background:var(--sand);
        }
        .msq-carousel-track{
          position:relative;
          width:100%;
          height:100%;
        }
        .msq-slide{
          position:absolute;
          inset:0;
          opacity:0;
          transition:opacity 0.6s ease;
        }
        .msq-slide.active{opacity:1;}
        .msq-slide img{
          width:100%;height:100%;object-fit:cover;
        }
        .msq-slide-caption{
          position:absolute;
          left:0;right:0;bottom:0;
          padding:28px 22px 24px;
          background:linear-gradient(to top, rgba(28,27,41,0.88), rgba(28,27,41,0));
          color:#fff;
        }
        .msq-slide-tag{
          display:inline-block;
          background:var(--red);
          color:#fff;
          font-size:0.75rem;
          font-weight:600;
          padding:4px 10px;
          border-radius:999px;
          margin-bottom:10px;
        }
        .msq-slide-caption h2{
          color:#fff;
          font-size:1.5rem;
          line-height:1.15;
          margin-bottom:6px;
        }
        .msq-slide-caption p{
          margin:0;
          font-size:0.9rem;
          color:rgba(255,255,255,0.82);
          max-width:34ch;
        }
        .msq-carousel-dots{
          position:absolute;
          top:18px;right:18px;
          display:flex;
          gap:6px;
        }
        .msq-dot{
          width:8px;height:8px;
          border-radius:50%;
          background:rgba(255,255,255,0.5);
          border:none;
          padding:0;
        }
        .msq-dot.active{background:#fff;width:22px;border-radius:5px;transition:width 0.25s ease;}
        .msq-carousel-arrows{
          position:absolute;
          inset:0;
          display:flex;
          align-items:center;
          justify-content:space-between;
          padding:0 12px;
          pointer-events:none;
        }
        .msq-carousel-arrows button{
          pointer-events:auto;
          width:36px;height:36px;
          border-radius:50%;
          border:none;
          background:rgba(28,27,41,0.45);
          color:#fff;
          display:flex;align-items:center;justify-content:center;
        }

        /* ============ SECTION HEADS ============ */
        .msq-section{
          padding:36px 20px;
          max-width:var(--maxw);
          margin:0 auto;
        }
        .msq-section-head{
          display:flex;
          align-items:flex-end;
          justify-content:space-between;
          margin-bottom:18px;
          gap:12px;
        }
        .msq-section-head h2{
          font-size:1.5rem;
        }
        .msq-section-head .msq-sub{
          color:var(--ink-soft);
          font-size:0.9rem;
          margin-top:4px;
        }
        .msq-see-all{
          font-size:0.85rem;
          font-weight:600;
          color:var(--teal);
          white-space:nowrap;
          padding-bottom:3px;
          border-bottom:1px solid var(--teal);
        }

        /* ============ PROMO BENTO ============ */
        .msq-bento{
          display:grid;
          grid-template-columns:1fr;
          gap:14px;
        }
        .msq-promo-card{
          position:relative;
          border-radius:var(--radius-lg);
          overflow:hidden;
          min-height:200px;
          background:var(--sand);
        }
        .msq-promo-card img{
          width:100%;height:100%;
          object-fit:cover;
          position:absolute;inset:0;
        }
        .msq-promo-card .msq-overlay{
          position:relative;
          height:100%;
          display:flex;
          flex-direction:column;
          justify-content:flex-end;
          padding:20px;
          background:linear-gradient(to top, rgba(28,27,41,0.82) 10%, rgba(28,27,41,0.05) 70%);
          min-height:200px;
        }
        .msq-promo-card h3{
          color:#fff;
          font-size:1.15rem;
          line-height:1.2;
        }
        .msq-promo-card .msq-meta{
          color:rgba(255,255,255,0.78);
          font-size:0.82rem;
          margin-top:4px;
        }
        .msq-promo-card.tall{min-height:340px;}
        .msq-promo-card.tall .msq-overlay{min-height:340px;}

        /* ============ INFO / FOOTER ============ */
        .msq-info-band{
          background:var(--ink);
          color:var(--paper);
          padding:44px 20px;
          margin-top:20px;
        }
        .msq-info-grid{
          max-width:var(--maxw);
          margin:0 auto;
          display:grid;
          grid-template-columns:1fr;
          gap:32px;
        }
        .msq-info-col h4{
          font-family:'Archivo Expanded', sans-serif;
          font-size:1rem;
          color:var(--gold);
          margin-bottom:12px;
        }
        .msq-info-col p, .msq-info-col a{
          display:block;
          font-size:0.88rem;
          color:rgba(250,246,239,0.75);
          line-height:1.9;
        }
        .msq-info-col.brand p{
          color:rgba(250,246,239,0.6);
          line-height:1.6;
          max-width:32ch;
        }
        .msq-info-bottom{
          max-width:var(--maxw);
          margin:32px auto 0;
          padding-top:20px;
          border-top:1px solid rgba(250,246,239,0.15);
          font-size:0.8rem;
          color:rgba(250,246,239,0.5);
          display:flex;
          justify-content:space-between;
          flex-wrap:wrap;
          gap:8px;
        }

        /* ============ TABLET / DESKTOP ============ */
        @media (min-width:720px){
          .msq-carousel{aspect-ratio:16/9;}
          .msq-bento{
            grid-template-columns:1.3fr 1fr 1fr;
            grid-template-rows:auto auto;
          }
          .msq-bento .msq-promo-card:nth-child(1){grid-row:1 / 3;min-height:100%;}
          .msq-bento .msq-promo-card:nth-child(1) .msq-overlay{min-height:100%;}
          .msq-info-grid{grid-template-columns:1.4fr 1fr 1fr 1fr;}
        }

        @media (min-width:960px){
          .msq-primary-nav{display:flex;}
          .msq-hamburger{display:none;}
          .msq-slide-caption h2{font-size:2rem;}
          .msq-section-head h2{font-size:1.9rem;}
          .msq-carousel{aspect-ratio:21/8;}
        }
      `}</style>

      <header className="msq-header">
        <div className="msq-header-row">
          <a href="#" className="msq-logo">
            <img src="gripstyle-logo.png" alt="Meridian Square" />
          </a>
          <nav className="msq-primary-nav">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href}>{l.label}</a>
            ))}
          </nav>
          <div className="msq-header-actions">
            <button className="msq-icon-btn" aria-label="Search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            <button className="msq-hamburger" aria-label="Open menu" onClick={() => setNavOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="14" x2="21" y2="14"/><line x1="3" y1="21" x2="21" y2="21"/></svg>
            </button>
          </div>
        </div>
      </header>

      <div className={`msq-mobile-nav${navOpen ? ' open' : ''}`}>
        <div className="msq-mobile-nav-top">
          <a href="#" className="msq-logo">
            <img src="/logo.png" alt="Meridian Square" />
          </a>
          <button className="msq-icon-btn" aria-label="Close menu" onClick={() => setNavOpen(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {NAV_LINKS.map((l) => (
          <a key={l.href} href={l.href} onClick={() => setNavOpen(false)}>{l.label}</a>
        ))}
        <div className="msq-mall-info">
          Open today 10:00 – 22:00<br />
          14 Riverside Ave, Sector 6
        </div>
      </div>

      <section className="msq-hero-section">
        <div className="msq-hero-grid">
          <div className="msq-carousel">
            <div className="msq-carousel-track">
              {SLIDES.map((s, i) => (
                <div key={s.title} className={`msq-slide${i === current ? ' active' : ''}`}>
                  <img src={s.img} alt={s.alt} />
                  <div className="msq-slide-caption">
                    <span className="msq-slide-tag">{s.tag}</span>
                    <h2>{s.title}</h2>
                    <p>{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="msq-carousel-dots">
              {SLIDES.map((s, i) => (
                <button
                  key={s.title}
                  className={`msq-dot${i === current ? ' active' : ''}`}
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => goTo(i)}
                />
              ))}
            </div>
            <div className="msq-carousel-arrows">
              <button aria-label="Previous slide" onClick={() => goTo(current - 1)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button aria-label="Next slide" onClick={() => goTo(current + 1)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="msq-section" id="promotions">
        <div className="msq-section-head">
          <div>
            <h2>Live right now</h2>
            <div className="msq-sub">Offers running across the mall this week</div>
          </div>
          <a className="msq-see-all" href="#">See all</a>
        </div>
        <div className="msq-bento">
          {PROMOS.map((p) => (
            <div key={p.title} className={`msq-promo-card${p.tall ? ' tall' : ''}`}>
              <img src={p.img} alt={p.alt} />
              <div className="msq-overlay">
                <h3>{p.title}</h3>
                <div className="msq-meta">{p.meta}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="msq-info-band" id="visit">
        <div className="msq-info-grid">
          <div className="msq-info-col brand">
            <h4>Meridian Square</h4>
            <p>Three floors of fashion, food, and everyday errands, open every day of the week.</p>
          </div>
          <div className="msq-info-col">
            <h4>Visit</h4>
            <p>14 Riverside Ave, Sector 6</p>
            <p>Open 10:00 – 22:00 daily</p>
            <a href="#">Get directions</a>
          </div>
          <div className="msq-info-col">
            <h4>Explore</h4>
            <a href="#">Store directory</a>
            <a href="#">Dining</a>
            <a href="#">Current promotions</a>
            <a href="#">Gift cards</a>
          </div>
          <div className="msq-info-col">
            <h4>Support</h4>
            <a href="#">Customer service</a>
            <a href="#">Parking</a>
            <a href="#">Lost &amp; found</a>
          </div>
        </div>
        <div className="msq-info-bottom">
          <span>© 2026 Meridian Square</span>
          <span>Privacy · Terms</span>
        </div>
      </div>
    </div>
  );
}