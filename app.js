window.addEventListener("DOMContentLoaded", () => {

  // ----------------------
  // Fake indoor map
  // ----------------------
  const NODES = {
    UVZ:[0.18,0.25], HALL1:[0.30,0.25], HALL2:[0.45,0.25], HALL3:[0.60,0.25],
    ELEV:[0.70,0.35], LAB:[0.45,0.12], CARD:[0.60,0.55], NEURO:[0.80,0.65],
    ICU:[0.30,0.55], OPH:[0.85,0.30], A112:[0.62,0.42],
  };

  const EDGES = {
    UVZ:["HALL1"],
    HALL1:["UVZ","HALL2","ICU"],
    HALL2:["HALL1","HALL3","LAB"],
    HALL3:["HALL2","ELEV","A112"],
    ELEV:["HALL3","CARD","OPH","NEURO"],
    LAB:["HALL2"], ICU:["HALL1"], A112:["HALL3"],
    CARD:["ELEV"], OPH:["ELEV"], NEURO:["ELEV"],
  };

  const PLACES = {
    kardiologija:{hr:["Kardiologija","1. kat • doktori i ambulante"], en:["Cardiology","Floor 1 • clinics"], node:"CARD", icon:"❤️"},
    laboratorij:{hr:["Laboratorij","Prizemlje (kat 0)"], en:["Laboratory","Ground floor"], node:"LAB", icon:"🧪"},
    neurologija:{hr:["Neurologija","2. kat • ambulante"], en:["Neurology","Floor 2 • clinics"], node:"NEURO", icon:"🧠"},
    dr_marko:{hr:["Prof. Dr. Marko Horvat","1. kat, ambulanta 112"], en:["Prof. Dr. Marko Horvat","Floor 1, room 112"], node:"A112", icon:"👨‍⚕️"},
    dr_ivan:{hr:["Dr. Ivan Petrić","Klinika oftalmologija"], en:["Dr. Ivan Petric","Ophthalmology"], node:"OPH", icon:"👁️"},
    leonora:{hr:["Leonora Čajani","Intenzivna"], en:["Leonora Cajani","ICU"], node:"ICU", icon:"💓"},
  };

  const DOCTORS = ["dr_marko","leonora","dr_ivan","laboratorij","neurologija"];

  // ----------------------
  // Language
  // ----------------------
  let LANG = "hr";
  const TXT = {
    hr: {
      app:"Bolnička Navigacija",
      loginTitle:"Prijavite se ili nastavite kao gost:",
      guest:"Nastavi kao gost",
      staff:"Prijava za medicinsko osoblje",
      qr:"Ili skenirajte QR kod",
      loc:"Koristi moju lokaciju",
      locOff:"Lokacija: nije uključena",
      locWait:"Tražim lokaciju…",
      popular:"Popularne pretrage",
      doctors:"Doktori",
      profile:"Moj profil",
      home:"Početna",
      map:"Karta",
      logout:"Odjava",
      qrRes:"QR rezultat",
      cancel:"Odustani",
      invalid:"Upiši ispravan email.",
      passShort:"Lozinka (demo) min 4 znaka.",
      signed:"Ulogiran korisnik (demo)",
      guestProfile:"Gost",
      guestSub:"Nije prijavljen (demo)",
      routeFrom:"Moja lokacija → ",
      routeMeta:(m)=>`Dolazak: 00:21 • ${m} m • Uglavnom ravno`,
    },
    en: {
      app:"Hospital Navigation",
      loginTitle:"Sign in or continue as guest:",
      guest:"Continue as guest",
      staff:"Staff sign-in",
      qr:"Or scan a QR code",
      loc:"Use my location",
      locOff:"Location: off",
      locWait:"Getting location…",
      popular:"Popular searches",
      doctors:"Doctors",
      profile:"Profile",
      home:"Home",
      map:"Map",
      logout:"Log out",
      qrRes:"QR result",
      cancel:"Cancel",
      invalid:"Enter a valid email.",
      passShort:"Password (demo) min 4 chars.",
      signed:"Signed-in user (demo)",
      guestProfile:"Guest",
      guestSub:"Not signed in (demo)",
      routeFrom:"My location → ",
      routeMeta:(m)=>`Arrive: 00:21 • ${m} m • Mostly straight`,
    }
  };
  const t = (k, ...a) => (typeof TXT[LANG][k] === "function") ? TXT[LANG][k](...a) : TXT[LANG][k];

  // ----------------------
  // Helpers (safe element get)
  // ----------------------
  const $ = (id) => document.getElementById(id);

  // ----------------------
  // Screens
  // ----------------------
  const screens = {
    login:$("screen-login"),
    home:$("screen-home"),
    route:$("screen-route"),
    profile:$("screen-profile"),
  };
  const tabs = document.querySelectorAll(".tab");

  function showScreen(name){
    Object.values(screens).forEach(s => s.classList.remove("active"));
    screens[name].classList.add("active");
    tabs.forEach(tbtn => tbtn.classList.toggle("active", tbtn.dataset.go === name));
  }

  // ----------------------
  // Render lists
  // ----------------------
  function makeItem(key){
    const [title, sub] = PLACES[key][LANG];
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="icon">${PLACES[key].icon || "📍"}</div>
      <div class="meta">
        <div class="headline">${title}</div>
        <div class="sub">${sub}</div>
      </div>
      <div class="go">›</div>
    `;
    el.onclick = () => openRoute(key);
    return el;
  }

  function renderPopular(){
    const host = $("popular-list");
    host.innerHTML = "";
    ["kardiologija","laboratorij","neurologija"].forEach(k => host.appendChild(makeItem(k)));
  }

  function renderDoctors(filter=""){
    const host = $("doctor-list");
    host.innerHTML = "";
    const f = filter.trim().toLowerCase();
    DOCTORS
      .filter(k => !f || PLACES[k][LANG][0].toLowerCase().includes(f))
      .forEach(k => host.appendChild(makeItem(k)));
  }

  // ----------------------
  // Demo login (offline)
  // ----------------------
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const setUser = (email) => localStorage.setItem("demo_user_email", email);
  const getUser = () => localStorage.getItem("demo_user_email");
  const clearUser = () => localStorage.removeItem("demo_user_email");

  function refreshProfile(){
    const email = getUser();
    $("profile-name").textContent = email ? email : t("guestProfile");
    $("profile-sub").textContent  = email ? t("signed") : t("guestSub");
  }

  // ----------------------
  // Location (GPS) demo
  // ----------------------
  let USER_NORM = null;
  let USER_START_NODE = "UVZ";
  const HOSPITAL_CENTER = { lat:45.8150, lon:15.9819 };
  const DEMO_W = 120, DEMO_H = 120;

  const metersPerDegLat = () => 111320;
  const metersPerDegLon = (lat) => 111320 * Math.cos(lat * Math.PI/180);

  function gpsToNorm(lat, lon){
    const dLat = lat - HOSPITAL_CENTER.lat;
    const dLon = lon - HOSPITAL_CENTER.lon;
    const dy = dLat * metersPerDegLat();
    const dx = dLon * metersPerDegLon(HOSPITAL_CENTER.lat);
    let x = 0.5 + (dx / DEMO_W);
    let y = 0.5 + (dy / DEMO_H);
    x = Math.max(0.02, Math.min(0.98, x));
    y = Math.max(0.02, Math.min(0.98, y));
    return {x, y};
  }

  function nearestNode(nx, ny){
    let best="UVZ", bestD=Infinity;
    for(const id of Object.keys(NODES)){
      const [x,y]=NODES[id];
      const d=(x-nx)*(x-nx)+(y-ny)*(y-ny);
      if(d<bestD){bestD=d;best=id;}
    }
    return best;
  }

  function requestLocation(){
    if(!("geolocation" in navigator)){ alert("No geolocation"); return; }
    $("loc-status").textContent = t("locWait");
    navigator.geolocation.getCurrentPosition(
      (pos)=>{
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        USER_NORM = gpsToNorm(lat, lon);
        USER_START_NODE = nearestNode(USER_NORM.x, USER_NORM.y);
        $("loc-status").textContent = (LANG==="hr")
          ? `Lokacija: uključena (start: ${USER_START_NODE})`
          : `Location: on (start: ${USER_START_NODE})`;
      },
      ()=>{
        $("loc-status").textContent = (LANG==="hr")
          ? "Lokacija: nije dostupna (provjeri dozvolu)."
          : "Location: unavailable (check permission).";
      },
      { enableHighAccuracy:true, timeout:10000, maximumAge:0 }
    );
  }

  // ----------------------
  // Routing BFS
  // ----------------------
  function shortestPath(start, goal){
    if(start===goal) return [start];
    const q=[start], prev={ [start]: null };
    while(q.length){
      const cur=q.shift();
      for(const nxt of (EDGES[cur]||[])){
        if(!(nxt in prev)){
          prev[nxt]=cur;
          if(nxt===goal){ q.length=0; break; }
          q.push(nxt);
        }
      }
    }
    if(!(goal in prev)) return [start];
    const path=[];
    for(let cur=goal; cur!==null; cur=prev[cur]) path.push(cur);
    path.reverse();
    return path;
  }

  function resolveDestination(input){
    const raw = String(input||"").trim();
    const low = raw.toLowerCase();
    const up  = raw.toUpperCase();
    if(low in PLACES) return { title: PLACES[low][LANG][0], node: PLACES[low].node };
    if(up in NODES) return { title: up, node: up };
    return null;
  }

  // ----------------------
  // SVG map
  // ----------------------
  function rect(x,y,w,h,rx,fill){
    const r=document.createElementNS("http://www.w3.org/2000/svg","rect");
    r.setAttribute("x",x); r.setAttribute("y",y);
    r.setAttribute("width",w); r.setAttribute("height",h);
    r.setAttribute("rx",String(rx)); r.setAttribute("fill",fill);
    return r;
  }
  function circle(cx,cy,rr,fill){
    const c=document.createElementNS("http://www.w3.org/2000/svg","circle");
    c.setAttribute("cx",cx); c.setAttribute("cy",cy);
    c.setAttribute("r",rr); c.setAttribute("fill",fill);
    return c;
  }
  function polyline(points, stroke, width, cap){
    const p=document.createElementNS("http://www.w3.org/2000/svg","polyline");
    p.setAttribute("points", points);
    p.setAttribute("fill","none");
    p.setAttribute("stroke", stroke);
    p.setAttribute("stroke-width", String(width));
    p.setAttribute("stroke-linecap", cap);
    p.setAttribute("stroke-linejoin","round");
    return p;
  }

  function drawMap(path, start, goal){
    const svg=$("map");
    svg.innerHTML="";

    const xy=(id)=>{
      const [nx,ny]=NODES[id];
      return [nx*100, (1-ny)*100];
    };

    // blocks
    [[5,20,26,18],[38,18,20,16],[70,18,24,16],[70,55,24,16],[34,70,24,16]]
      .forEach(([x,y,w,h])=>svg.appendChild(rect(x,y,w,h,4,"#e7eef9")));

    // hallway
    const hall = ["UVZ","HALL1","HALL2","HALL3","ELEV"].map(id=>xy(id).join(",")).join(" ");
    svg.appendChild(polyline(hall,"#cbd6e6",8,"round"));

    // route
    const pts = path.map(id=>xy(id));
    const routePts = pts.map(p=>p.join(",")).join(" ");
    const route = polyline(routePts,"#1f5faa",4,"round");
    route.setAttribute("stroke-dasharray","2 6");
    svg.appendChild(route);

    // start marker
    if(USER_NORM){
      const ux = USER_NORM.x*100;
      const uy = (1-USER_NORM.y)*100;
      svg.appendChild(circle(ux,uy,2.8,"#1b85ff"));
    } else {
      const [sx,sy]=xy(start);
      svg.appendChild(circle(sx,sy,2.6,"#1b85ff"));
    }

    // goal
    const [gx,gy]=xy(goal);
    svg.appendChild(circle(gx,gy,3.2,"#e53935"));
    svg.appendChild(circle(gx,gy,1.4,"#ffffff"));
  }

  function openRoute(dest){
    const r = resolveDestination(dest);
    if(!r){
      alert(LANG==="hr" ? "Ne prepoznajem odredište. Probaj: A112 ili kardiologija" : "Unknown destination. Try: A112 or kardiologija");
      return;
    }
    const start = USER_START_NODE || "UVZ";
    const goal = r.node;
    const path = shortestPath(start, goal);

    $("route-head").textContent = t("routeFrom") + r.title;
    const distance_m = Math.max(60, 20 * path.length);
    $("route-meta").textContent = t("routeMeta", distance_m);

    $("pill-wheel").textContent = "♿ 1 min";
    $("pill-walk").textContent  = "🚶 1 min";
    $("pill-bed").textContent   = "🛏 1 min";
    $("pill-eta").textContent   = "⏱ 00:21";

    drawMap(path, start, goal);
    showScreen("route");
  }

  // ----------------------
  // Hook up UI
  // ----------------------
  function applyLanguage(){
    $("t_app_title").textContent = t("app");
    $("t_login_title").textContent = t("loginTitle");
    $("btn-guest").textContent = t("guest");
    $("btn-staff").textContent = t("staff");
    $("btn-qr").textContent = t("qr");
    $("btn-loc").textContent = t("loc");
    $("t_popular").textContent = t("popular");
    $("t_doctors").textContent = t("doctors");
    $("t_tab_home").textContent = t("home");
    $("t_tab_map").textContent = t("map");
    $("t_tab_profile").textContent = t("profile");
    $("btn-logout").textContent = t("logout");
    $("t_qr_result").textContent = t("qrRes");
    $("btn-close").textContent = t("cancel");
    $("loc-status").textContent = t("locOff");
    refreshProfile();
    renderPopular();
    renderDoctors($("doctor-search").value || "");
  }

  $("lang-btn").onclick = () => {
    LANG = (LANG==="hr") ? "en" : "hr";
    $("lang-btn").textContent = (LANG==="hr") ? "HR ▾" : "EN ▾";
    applyLanguage();
  };

  $("btn-staff").onclick = () => alert("MVP: staff login UI");

  $("btn-login").onclick = () => {
    const email = ($("email-input").value || "").trim().toLowerCase();
    const pass  = ($("pass-input").value || "").trim();
    if(!isValidEmail(email)){ alert(t("invalid")); return; }
    if(pass.length < 4){ alert(t("passShort")); return; }
    setUser(email);
    refreshProfile();
    showScreen("home");
  };

  $("btn-guest").onclick = () => {
    clearUser();
    refreshProfile();
    showScreen("home");
  };

  $("btn-logout").onclick = () => {
    clearUser();
    refreshProfile();
    showScreen("login");
  };

  $("btn-qr").onclick = () => {
    const msg = (LANG==="hr")
      ? "Upiši QR kod (npr. A112) ili naziv (kardiologija):"
      : "Type QR code (e.g. A112) or name (kardiologija):";
    const code = prompt(msg);
    if(code) openRoute(code);
  };

  $("btn-loc").onclick = () => requestLocation();

  $("featured-card").onclick = () => openRoute("dr_marko");

  $("doctor-search").addEventListener("input", (e)=>renderDoctors(e.target.value));

  $("search-input").addEventListener("keydown", (e)=>{
    if(e.key==="Enter"){
      const q = e.target.value.trim().toLowerCase();
      const found = Object.keys(PLACES).find(k => PLACES[k][LANG][0].toLowerCase().includes(q));
      if(found) openRoute(found);
      else alert(LANG==="hr" ? "Nema rezultata (MVP)." : "No results (MVP).");
    }
  });

  tabs.forEach(btn => btn.onclick = () => showScreen(btn.dataset.go));
  $("btn-back").onclick = () => showScreen("home");
  $("btn-close").onclick = () => showScreen("home");

  // boot
  applyLanguage();
  if(getUser()) showScreen("home");

});
