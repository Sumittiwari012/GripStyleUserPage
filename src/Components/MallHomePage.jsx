import React, { useState, useEffect, useRef } from 'react';

const SLIDES = [
  {
    title: 'Men',
    img: '/img1.jpeg',
    alt: "Men's clothing rack styled for the new season",
    containOnMobile: true,
  },
  {
    title: 'Women',
    img: '/img2.jpeg',
    alt: "Women's fashion display with seasonal layers",
  },
  {
    title: 'Kids',
    img: '/img3.jpeg',
    alt: "Children's clothing rack with bright colours",
  },
  {
    title: 'New arrivals',
    img: '/img4.jpeg',
    alt: 'Storefront highlighting new seasonal arrivals',
  },
];

const MALL_LAT = 22.620179774545534;
const MALL_LNG = 88.39212575400862;
const MALL_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${MALL_LAT},${MALL_LNG}`;

const NAV_LINKS = [
  { label: 'Visit', href: MALL_MAPS_URL },
];

const SHOP_ADDRESS = '11/1A, Dumdum Road, Kolkata 700030';
const SHOP_PHONE = '6290621212';
const INSTAGRAM_URL = 'https://www.instagram.com/gripstyle.showroom?stkn=MTluYndjOXZrZ2tvZw%3D%3D&utm_source=qr';
const FACEBOOK_URL = 'https://www.facebook.com/share/1CGVew1jXP/?mibextid=wwXIfr';
const LOGO_SRC = '/gripstyle-logo.png';

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
          padding:10px 20px;
          max-width:var(--maxw);
          margin:0 auto;
        }
        .msq-logo{
          display:flex;
          align-items:center;
        }
        .msq-logo img{
          height:52px;
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
        .msq-mobile-nav a.msq-logo{
          padding:0;
          border-bottom:none;
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
          filter:saturate(1.25) contrast(1.05);
        }
        @media (max-width:719px){
          .msq-slide.fit-contain{background:var(--ink);}
          .msq-slide.fit-contain img{object-fit:contain;}
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
        .msq-social-row{
          display:flex;
          align-items:center;
          justify-content:flex-start;
          gap:18px;
          margin-top:8px;
        }

        .msq-social-btn{
          width:64px;
          height:64px;
          min-width:64px;
          min-height:64px;
          flex:0 0 64px;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:0;
          margin:0;
          border-radius:50%;
          overflow:hidden;
          line-height:0;
          text-decoration:none;
          box-sizing:border-box;
          transition:transform 0.15s ease, opacity 0.15s ease;
        }

        .msq-social-btn img{
          width:100%;
          height:100%;
          display:block;
          object-fit:cover;
          object-position:center;
          border-radius:50%;
          margin:0;
          padding:0;
        }

        .msq-social-btn.instagram img{
          transform:scale(0.65);
        }

        .msq-social-btn:hover{
          transform:scale(1.06);
          opacity:0.92;
        }
        .msq-social-btn.instagram:hover img{
          transform:scale(0.78) scale(1.06);
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
          .msq-info-grid{grid-template-columns:1.4fr 1fr 1fr;}
        }

        @media (min-width:960px){
          .msq-primary-nav{display:flex;}
          .msq-hamburger{display:none;}
          .msq-carousel{aspect-ratio:21/8;}
          .msq-logo img{height:68px;}
        }
      `}</style>

      <header className="msq-header">
        <div className="msq-header-row">
          <a href="#" className="msq-logo">
            <img src={LOGO_SRC} alt="gripstyle logo" />
          </a>
          <nav className="msq-primary-nav">
            {NAV_LINKS.map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer">
                {l.label}
              </a>
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
            <img src={LOGO_SRC} alt="gripstyle logo" />
          </a>
          <button className="msq-icon-btn" aria-label="Close menu" onClick={() => setNavOpen(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {NAV_LINKS.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setNavOpen(false)}
          >
            {l.label}
          </a>
        ))}
        <div className="msq-mall-info">
          Open today 10:00 – 22:00<br />
          {SHOP_ADDRESS}
        </div>
      </div>

      <section className="msq-hero-section">
        <div className="msq-hero-grid">
          <div className="msq-carousel">
            <div className="msq-carousel-track">
              {SLIDES.map((s, i) => (
                <div
                  key={s.title}
                  className={`msq-slide${i === current ? ' active' : ''}${s.containOnMobile ? ' fit-contain' : ''}`}
                >
                  <img src={s.img} alt={s.alt} />
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

      <div className="msq-info-band" id="visit">
        <div className="msq-info-grid">
          <div className="msq-info-col">
            <h4>Shop Location</h4>
            <p>{SHOP_ADDRESS}</p>
            <p>Open 10:00 – 22:00 daily</p>
            <a href={MALL_MAPS_URL} target="_blank" rel="noopener noreferrer">Get directions</a>
          </div>
          <div className="msq-info-col">
            <h4>Contact</h4>
            <a href={`tel:+91${SHOP_PHONE}`}>{SHOP_PHONE}</a>
          </div>
          <div className="msq-info-col">
            <h4>Follow Us</h4>
            <div className="msq-social-row">
              <a
                href={FACEBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="msq-social-btn facebook"
              >
                <img src="/fb.webp" alt="Facebook" />
              </a>

              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="msq-social-btn instagram"
              >
                <img src="/insta.png" alt="Instagram" />
              </a>
            </div>
          </div>
        </div>
        <div className="msq-info-bottom">
          <span>© 2026</span>
          <span>Privacy · Terms</span>
        </div>
      </div>
    </div>
  );
}