/* PizzaHust shared chrome: logo, icons, customer nav, footer, admin sidebar */
(function () {
  const I = {
    cart: '<path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6 5 3H2"/><circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    truck: '<path d="M3 6h11v9H3z"/><path d="M14 9h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
    arrow: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
    package: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
    home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    utensils: '<path d="M5 3v7a2 2 0 0 0 4 0V3M7 10v11"/><path d="M17 3c-1.5 1-2 3-2 5s.5 3 2 3v10"/>',
    gift: '<rect x="3" y="9" width="18" height="12" rx="1.5"/><path d="M3 13h18M12 9v12"/><path d="M12 9C9 9 7 7.5 7 6s2-2 5 3c3-5 5-4.5 5-3s-2 3-5 3z"/>',
    bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5"/><path d="M16 5.5a3 3 0 0 1 0 5.8M21 20c0-2.4-1.6-4-4-4.6"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    edit: '<path d="M14 5l5 5M4 20l1-4L16 5l3 3L8 19z"/>',
    trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    phone: '<path d="M5 4h4l2 5-3 2c1 2 3 4 5 5l2-3 5 2v4c0 1-1 2-2 2C10 21 3 14 3 6c0-1 1-2 2-2z"/>',
    pin: '<path d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    award: '<circle cx="12" cy="9" r="6"/><path d="M9 14l-2 7 5-3 5 3-2-7"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 4v4h-4"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19"/>',
    moon: '<path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5z"/>',
    layers: '<path d="M12 3 3 8l9 5 9-5z"/><path d="M3 12.5l9 5 9-5M3 17l9 5 9-5"/>',
    sliders: '<path d="M4 8h10M18 8h2M4 16h2M10 16h10"/><circle cx="16" cy="8" r="2.2"/><circle cx="8" cy="16" r="2.2"/>',
    upload: '<path d="M12 16V5M7 9l5-4 5 4"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    unlock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.7-1.5"/>',
    flame: '<path d="M12 3c1 3-3 4.5-3 8a3 3 0 0 0 6 0c0-1-.5-2-1-2.5 2 .5 4 2.5 4 5.5a6 6 0 0 1-12 0c0-5 5-7 6-11z"/>',
    alert: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17.2v.3"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.8z"/>',
    pizza: '<path d="M12 3.5 21 9c-4 8-12 12-12 12S3 13 3 9z" fill="#fff" stroke="none"/>'
  };
  function svg(name, sw) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw||1.9}" stroke-linecap="round" stroke-linejoin="round">${I[name]}</svg>`;
  }
  window.PH_ICON = svg;

  /* ---------- Theme ---------- */
  const savedTheme = (function(){ try { return localStorage.getItem('ph-theme'); } catch(e){ return null; } })() || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  function themeIcon() { return document.documentElement.getAttribute('data-theme') === 'dark' ? svg('sun') : svg('moon'); }
  function refreshThemeBtns() { document.querySelectorAll('.theme-btn').forEach(b => { b.innerHTML = themeIcon(); }); }
  window.toggleTheme = function () {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('ph-theme', next); } catch(e){}
    refreshThemeBtns();
  };
  window.PH_THEME_BTN = function (extra) {
    return `<button class="icon-btn theme-btn" type="button" onclick="toggleTheme()" aria-label="Toggle dark mode" ${extra||''}></button>`;
  };
  document.addEventListener('DOMContentLoaded', refreshThemeBtns);
  window.PH_REFRESH_THEME_BTNS = refreshThemeBtns;

  const LOGO = `<span class="logo"><svg viewBox="0 0 24 24" fill="none"><path d="M12 4 20 8.5c-3.4 7.2-8 11-8 11S7.4 15.7 4 8.5z" fill="#fff"/><circle cx="10" cy="9.2" r="1.05" fill="#D62A2A"/><circle cx="13.4" cy="8.4" r=".95" fill="#D62A2A"/><circle cx="12" cy="12.2" r="1.05" fill="#D62A2A"/></svg></span>`;
  window.PH_LOGO = LOGO;

  window.mountNav = function (active, opts) {
    opts = opts || {};
    const el = document.getElementById('nav'); if (!el) return;
    const links = [['index.html','Home','Home'],['menu.html','Menu','Menu'],['combos.html','Combos','Combos'],['track.html','Track Order','Track Order']];
    const linksHtml = links.map(l => `<a href="${l[0]}" class="${active===l[2]?'active':''}">${l[1]}</a>`).join('');
    const pts = opts.points ? `<a class="pts-badge" href="loyalty.html">${svg('award')}<span>${opts.points} pts</span></a>` : '';
    const count = opts.cart ? `<span class="cart-count">${opts.cart}</span>` : '';
    el.className = 'nav';
    el.innerHTML = `<div class="container nav-inner">
      <a class="brand" href="index.html">${LOGO}<span>Pizza<b>Hust</b></span></a>
      <nav class="nav-links">${linksHtml}</nav>
      <div class="nav-actions">
        ${pts}
        ${window.PH_THEME_BTN()}
        <a class="icon-btn" href="cart.html" aria-label="Cart">${svg('cart')}${count}</a>
        <a class="icon-btn" href="account.html" aria-label="Account">${svg('user')}</a>
      </div>
    </div>`;
    refreshThemeBtns();
  };

  window.mountFooter = function () {
    const el = document.getElementById('footer'); if (!el) return;
    el.className = 'footer';
    el.innerHTML = `<div class="container footer-grid">
      <div>
        <div class="brand">${LOGO}<span>Pizza<b style="color:var(--brand-500)">Hust</b></span></div>
        <p class="small" style="max-width:260px;color:#aab1bd">The best pizza in town, delivered hot and fresh to your door.</p>
      </div>
      <div><h4>Quick Links</h4><ul class="small"><li><a href="menu.html">Menu</a></li><li><a href="track.html">Track Order</a></li><li><a href="auth.html">Login</a></li></ul></div>
      <div><h4>Contact</h4><ul class="small"><li>Phone: (555) 123-4567</li><li>Email: info@pizzahust.com</li></ul></div>
      <div><h4>Hours</h4><ul class="small"><li>Mon–Thu: 11am – 11pm</li><li>Fri–Sat: 11am – 1am</li><li>Sunday: 12pm – 10pm</li></ul></div>
    </div>
    <div class="footer-bottom">© 2026 PizzaHust. All rights reserved.</div>`;
  };

  window.mountSidebar = function (active) {
    const el = document.getElementById('sidebar'); if (!el) return;
    const items = [
      ['admin-dashboard.html','Dashboard','grid'],
      ['admin-orders.html','Orders','bag'],
      ['admin-menu.html','Menu Management','utensils'],
      ['admin-categories.html','Categories','layers'],
      ['admin-combos.html','Combos & Campaigns','gift'],
      ['admin-customers.html','Customers','users'],
      ['admin-import.html','Import','upload'],
      ['admin-reports.html','Reports','chart'],
    ];
    const nav = items.map(i => `<a class="side-link ${active===i[1]?'active':''}" href="${i[0]}">${svg(i[2])}<span>${i[1]}</span></a>`).join('');
    el.className = 'sidebar';
    el.innerHTML = `<a class="brand" href="admin-dashboard.html">${LOGO}<span>Pizza<b>Hust</b></span></a>
      <nav class="side-nav">${nav}</nav>
      <div class="side-foot">
        <div class="side-card" style="margin-bottom:10px"><div class="label">Staff Views</div><a href="kitchen.html">${svg('flame',2)}Kitchen Queue</a></div>
        <div class="side-card" style="display:flex;align-items:center;justify-content:space-between;gap:10px">
          <div><div class="label">Admin Panel</div><a href="index.html">${svg('back',2)}Back to Website</a></div>
          ${window.PH_THEME_BTN('style="flex:none;border:1px solid var(--line-2);background:var(--surface)"')}
        </div>
      </div>`;
    refreshThemeBtns();
  };
})();
