let photos = [];

const grid = document.getElementById("grid");
const lb = document.getElementById("lightbox");
const lbImg = document.getElementById("lbImg");
const lbClose = document.getElementById("lbClose");
const lbPrev = document.getElementById("lbPrev");
const lbNext = document.getElementById("lbNext");

let i = 0;

const url = f => `photos/${encodeURIComponent(f)}`;

/* Lightbox controls */
lbClose.onclick = () => {
  lb.classList.remove("open");
  document.body.style.overflow = "";
};

lbPrev.onclick = () =>
  show((i - 1 + photos.length) % photos.length);

lbNext.onclick = () =>
  show((i + 1) % photos.length);

/* Load photo list */
async function load() {
  const r = await fetch("photos.json", { cache: "no-store" });
  photos = await r.json();
}

/* Load image metadata */
async function meta() {
  return Promise.all(
    photos.map((f, idx) => new Promise(res => {
      const im = new Image();

      im.onload = () =>
        res({
          i: idx,
          f,
          ar: im.naturalWidth / im.naturalHeight
        });

      im.onerror = () => res(null);
      im.src = url(f);
    }))
  ).then(arr => arr.filter(Boolean));
}

/* Show image in lightbox */
function show(n) {
  i = n;
  lbImg.src = url(photos[i]);
  lb.classList.add("open");
  document.body.style.overflow = "hidden";
}

/* Render justified grid */
function render(m) {
  grid.innerHTML = "";

  const W = grid.clientWidth;
  let row = [];
  let sum = 0;

  const GAP = 14;
  const MIN = 320;
  const MAX = 520;

  const flush = (last = false) => {
    if (!row.length) return;

    let h = (W - GAP * (row.length - 1)) / sum;
    if (last) {
      h = Math.max(MIN, Math.min(MAX, h));
    }

    const r = document.createElement("div");
    r.className = "j-row";

    row.forEach(x => {
      const b = document.createElement("button");
      b.className = "j-item";
      b.style.width = `${h * x.ar}px`;
      b.style.height = `${h}px`;
      b.onclick = () => show(x.i);

      const im = document.createElement("img");
      im.src = url(x.f);

      b.appendChild(im);
      r.appendChild(b);
    });

    grid.appendChild(r);
    row = [];
    sum = 0;
  };

  m.forEach(x => {
    row.push(x);
    sum += x.ar;

    const h = (W - GAP * (row.length - 1)) / sum;

    if (h < MIN && row.length > 1) {
      const last = row.pop();
      sum -= last.ar;
      flush(false);
      row.push(last);
      sum += last.ar;
    } else if (h >= MIN && h <= MAX) {
      flush(false);
    }
  });

  flush(true);
}

/* Init */
(async () => {
  try {
    await load();
    const m = await meta();
    render(m);
  } catch (e) {
    grid.innerHTML = "<p>Failed to load</p>";
  }
})();
