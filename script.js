// Set the current year dynamically
document.getElementById('year').textContent = new Date().getFullYear();

// State
let albums = {};
let currentAlbum = null;
let currentPhotos = [];
let currentIndex = 0;
const unsortedPreviews = new Map();

// Performance: Track which album carousel is built for
let carouselBuiltForAlbum = null;

// Virtual carousel: only 3 slides in DOM [prev, current, next]
let virtualSlides = [];
let isSnapping = false;

// DOM elements
const lightbox = document.getElementById('lightbox');
const lbTrack = document.getElementById('lbTrack');
const lbClose = document.getElementById('lbClose');
const lbPrev = document.getElementById('lbPrev');
const lbNext = document.getElementById('lbNext');
const mainEl = document.querySelector('.main');

// ============================================
// Album loading and switching
// ============================================
async function loadAlbums() {
  try {
    const response = await fetch('photos.json');
    albums = await response.json();

    // Ensure _unsorted exists
    if (!albums._unsorted) albums._unsorted = [];

    const nav = document.getElementById('albumNav');
    const albumNames = Object.keys(albums).filter(n => n !== '_unsorted');

    albumNames.forEach((albumName) => {
      const link = document.createElement('a');
      link.textContent = albumName.toUpperCase();
      link.dataset.album = albumName;
      if (_mobileIntro) link.style.opacity = '0';
      link.addEventListener('click', (e) => {
        e.preventDefault();
        switchAlbum(albumName);
      });
      nav.appendChild(link);
    });

    if (albumNames.length > 0 && window.innerWidth > 768) {
      switchAlbum(albumNames[0]);
    }

    // Mobile sidebar entrance animation — staggered fade + slide
    if (_mobileIntro) {
      const sidebar = document.querySelector('.sidebar');
      const introEls = [];

      const h1 = sidebar.querySelector('h1');
      if (h1) introEls.push({ el: h1, delay: 200, dur: 700 });

      sidebar.querySelectorAll('nav a').forEach((a, i) => {
        introEls.push({ el: a, delay: 450 + i * 100, dur: 500 });
      });

      let d = 450 + sidebar.querySelectorAll('nav a').length * 100;
      ['.social', '.signature', '.theme-toggle', '.copyright'].forEach(sel => {
        const el = sidebar.querySelector(sel);
        if (el) { introEls.push({ el, delay: d, dur: 500 }); d += 100; }
      });

      // Set initial state and register transitions before any reveals
      introEls.forEach(({ el, dur }) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(8px)';
        el.style.transition = `opacity ${dur}ms ease, transform ${dur}ms ease`;
      });

      // Force reflow so browser commits initial state before transitions fire
      sidebar.offsetHeight;

      // Stagger reveals — only change values, transitions already registered
      introEls.forEach(({ el, delay }) => {
        setTimeout(() => {
          el.style.opacity = '';
          el.style.transform = '';
        }, delay);
      });

      // Clean up inline styles after all animations complete
      const last = introEls[introEls.length - 1];
      setTimeout(() => {
        introEls.forEach(({ el }) => {
          el.style.transition = '';
          el.style.transform = '';
        });
      }, last.delay + last.dur + 100);
    }

  } catch (error) {
    console.error('Failed to load albums:', error);
  }
}

function syncCurrentAlbum() {
  if (currentAlbum && albums[currentAlbum] !== undefined) {
    albums[currentAlbum] = currentPhotos.map(p => ({
      src: p.full.replace('photos/', ''),
      grid: p.grid.replace('photos/', ''),
      w: p.width,
      h: p.height
    }));
  }
}

function switchAlbum(albumName, clickedElement = null) {
  // If in edit mode, save current album's reorder before switching
  if (editMode && currentAlbum) {
    syncCurrentAlbum();
  }

  currentAlbum = albumName;
  const albumData = albums[albumName] || [];
  currentPhotos = albumData.map(p => ({
    full: `photos/${p.src}`,
    grid: `photos/${p.grid}`,
    width: p.w,
    height: p.h
  }));

  // Reset carousel cache when album changes
  carouselBuiltForAlbum = null;

  document.querySelectorAll('#albumNav a').forEach(link => {
    if (link.dataset.album === albumName) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  if (window.innerWidth <= 768) {
    document.getElementById('mobileHeaderTitle').textContent = albumName.toUpperCase();
    animateSlideIn();
  }

  if (editMode) {
    renderEditGrid();
  } else {
    renderGrid();
  }
}

// ============================================
// Slide-in animation for mobile
// ============================================
function animateSlideIn() {
  const main = document.querySelector('.main');
  
  main.style.transition = 'none';
  main.style.transform = 'translateX(100%)';
  main.classList.add('active');
  
  main.offsetHeight;
  
  main.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
  main.style.transform = 'translateX(0)';
  
  setTimeout(() => {
    main.style.transition = '';
    main.style.transform = '';
  }, 350);
}

// ============================================
// Grid rendering (uses pre-stored dimensions)
// ============================================
function renderGrid() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';

  const targetRowHeight = 320;
  const computedStyle = getComputedStyle(grid);
  const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
  const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
  const containerWidth = (grid.clientWidth || 1200) - paddingLeft - paddingRight;
  const gap = 6;

  let currentRow = [];
  let currentRowWidth = 0;

  currentPhotos.forEach((photo, index) => {
    const aspectRatio = photo.width / photo.height;
    const scaledWidth = targetRowHeight * aspectRatio;

    currentRow.push({ ...photo, index, aspectRatio });
    currentRowWidth += scaledWidth;

    const isLastPhoto = index === currentPhotos.length - 1;
    const rowFull = currentRowWidth + gap * (currentRow.length - 1) >= containerWidth;

    if (rowFull || isLastPhoto) {
      const totalGaps = gap * (currentRow.length - 1);
      const availableWidth = containerWidth - totalGaps;
      const scale = availableWidth / currentRowWidth;
      const adjustedHeight = targetRowHeight * scale;

      const rowDiv = document.createElement('div');
      rowDiv.className = 'grid-row';

      currentRow.forEach((item) => {
        const itemWidth = item.aspectRatio * adjustedHeight;
        const itemDiv = document.createElement('div');
        itemDiv.className = 'grid-item';
        itemDiv.style.width = `${itemWidth}px`;
        itemDiv.style.height = `${adjustedHeight}px`;

        const img = document.createElement('img');
        const gridKey = item.grid.replace('photos/', '');
        img.src = unsortedPreviews.get(gridKey) || (itemWidth > GRID_MAX_WIDTH ? item.full : item.grid);
        img.alt = '';
        img.loading = 'lazy';
        img.width = Math.round(itemWidth);
        img.height = Math.round(adjustedHeight);
        img.onerror = function() {
          if (this.src !== item.full) { this.src = item.full; }
        };
        img.addEventListener('click', (e) => openLightbox(item.index, e.currentTarget));

        itemDiv.appendChild(img);
        rowDiv.appendChild(itemDiv);
      });

      grid.appendChild(rowDiv);

      currentRow = [];
      currentRowWidth = 0;
    }
  });
}

// ============================================
// Lightbox carousel (uses full-res images)
// ============================================
function buildCarousel() {
  if (carouselBuiltForAlbum === currentAlbum) return;

  lbTrack.innerHTML = '';
  virtualSlides = [];
  for (let i = 0; i < 3; i++) {
    const slide = document.createElement('div');
    slide.className = 'lb-slide';
    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    slide.appendChild(img);
    lbTrack.appendChild(slide);
    virtualSlides.push(slide);
  }
  updateVirtualSlides();

  buildDots();
  carouselBuiltForAlbum = currentAlbum;
}

function updateVirtualSlides() {
  const prevIdx = currentIndex - 1;
  const nextIdx = currentIndex + 1;
  const slots = [prevIdx, currentIndex, nextIdx];
  for (let s = 0; s < 3; s++) {
    const img = virtualSlides[s].querySelector('img');
    const idx = slots[s];
    if (idx >= 0 && idx < currentPhotos.length) {
      const newSrc = currentPhotos[idx].full;
      if (img.getAttribute('src') !== newSrc) img.src = newSrc;
    } else {
      if (img.hasAttribute('src')) img.removeAttribute('src');
    }
  }
  // Preload 2 ahead in each direction
  preloadNearby(currentIndex);
}

const _preloadCache = new Map();
function preloadNearby(idx) {
  for (let offset = -2; offset <= 2; offset++) {
    const i = idx + offset;
    if (i < 0 || i >= currentPhotos.length) continue;
    const src = currentPhotos[i].full;
    if (!_preloadCache.has(src)) {
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
      _preloadCache.set(src, img);
    }
  }
  // Evict entries far from current view to limit memory
  if (_preloadCache.size > 10) {
    const activeSrcs = new Set();
    for (let offset = -3; offset <= 3; offset++) {
      const i = idx + offset;
      if (i >= 0 && i < currentPhotos.length) activeSrcs.add(currentPhotos[i].full);
    }
    for (const key of _preloadCache.keys()) {
      if (!activeSrcs.has(key)) _preloadCache.delete(key);
    }
  }
}

function buildDots() {
  const dotsContainer = document.getElementById('lbDots');
  dotsContainer.innerHTML = '';
  // Fixed clip window for >7 dots (7 slots × 10px); auto-size for ≤7
  dotsContainer.style.width = currentPhotos.length > 7 ? '70px' : '';
  const track = document.createElement('div');
  track.className = 'lb-dots-track';
  for (let i = 0; i < currentPhotos.length; i++) {
    const dot = document.createElement('span');
    dot.className = 'lb-dot';
    track.appendChild(dot);
  }
  dotsContainer.appendChild(track);
  updateDots();
}

function updateDots() {
  const track = document.querySelector('.lb-dots-track');
  if (!track) return;
  const dots = track.children;
  const total = dots.length;

  if (total <= 7) {
    // Show all dots, no sliding or shrinking
    track.style.transform = '';
    for (let i = 0; i < total; i++) {
      dots[i].className = 'lb-dot' + (i === currentIndex ? ' active' : '');
    }
    return;
  }

  const windowStart = Math.max(0, Math.min(currentIndex - 3, total - 7));

  for (let i = 0; i < total; i++) {
    const posInWindow = i - windowStart;
    let cls = 'lb-dot';

    if (i === currentIndex) {
      cls += ' active';
    }

    if (posInWindow < 0 || posInWindow > 6) {
      cls += ' hidden';
    } else if (posInWindow === 0 && windowStart > 0) {
      cls += ' tiny';
    } else if (posInWindow === 6 && windowStart < total - 7) {
      cls += ' tiny';
    } else if (posInWindow === 1 && windowStart > 0) {
      cls += ' small';
    } else if (posInWindow === 5 && windowStart < total - 7) {
      cls += ' small';
    }

    dots[i].className = cls;
  }

  track.style.transform = `translateX(${-windowStart * 10}px)`;
}

let snapTimer = null;

function goToSlide(index, animate = true) {
  resetZoom();
  // If navigating away from original photo, clear morph source
  if (index !== currentIndex) {
    if (morphSource) morphSource.style.opacity = '';
    morphSource = null;
    morphRect = null;
  }

  const centerOffset = -1 * window.innerWidth;

  if (animate && index !== currentIndex) {
    // If a snap is pending, fast-forward it without loading images
    if (isSnapping) {
      if (snapTimer) { clearTimeout(snapTimer); snapTimer = null; }
      isSnapping = false;
      lbTrack.style.transition = 'none';
      lbTrack.style.transform = `translateX(${centerOffset}px)`;
      // Force style recalc before starting next animation
      lbTrack.offsetHeight;
    }

    const direction = index > currentIndex ? 2 : 0; // slot 2 = next, slot 0 = prev

    // Pre-set the slide we're about to reveal
    const revealSlot = direction === 2 ? 2 : 0;
    const revealImg = virtualSlides[revealSlot].querySelector('img');
    const newSrc = currentPhotos[index].full;
    if (revealImg.getAttribute('src') !== newSrc) revealImg.src = newSrc;

    const targetOffset = -direction * window.innerWidth;
    lbTrack.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    lbTrack.style.transform = `translateX(${targetOffset}px)`;
    isSnapping = true;

    currentIndex = index;
    updateDots();

    // After animation, snap back to center with updated slides
    snapTimer = setTimeout(() => {
      snapTimer = null;
      completeSnap();
    }, 310);
  } else {
    currentIndex = index;
    updateVirtualSlides();
    lbTrack.style.transition = 'none';
    lbTrack.style.transform = `translateX(${centerOffset}px)`;
    updateDots();
  }

  if (window.innerWidth > 768) {
    lbPrev.style.display = currentIndex === 0 ? 'none' : 'block';
    lbNext.style.display = currentIndex === currentPhotos.length - 1 ? 'none' : 'block';
  }
}

function completeSnap() {
  isSnapping = false;
  updateVirtualSlides();
  lbTrack.style.transition = 'none';
  lbTrack.style.transform = `translateX(${-1 * window.innerWidth}px)`;
}

// Morph transition state
let morphSource = null;
let morphClone = null;
let morphRect = null;

function openLightbox(index, sourceImg) {
  buildCarousel();
  currentIndex = index;

  // If we have a source image, do the morph
  if (sourceImg) {
    morphSource = sourceImg;
    morphRect = sourceImg.getBoundingClientRect();

    // Create clone at grid position using grid image (already loaded/cached)
    morphClone = document.createElement('div');
    morphClone.className = 'morph-clone';
    morphClone.style.cssText = `
      position: fixed;
      left: ${morphRect.left}px;
      top: ${morphRect.top}px;
      width: ${morphRect.width}px;
      height: ${morphRect.height}px;
      z-index: 1002;
      overflow: hidden;
      will-change: transform;
    `;

    const cloneImg = document.createElement('img');
    cloneImg.src = sourceImg.src;
    cloneImg.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    morphClone.appendChild(cloneImg);
    document.body.appendChild(morphClone);

    // Hide the source in the grid
    morphSource.style.opacity = '0';

    // Show lightbox backdrop only (hide the track)
    lightbox.classList.add('active');
    lightbox.style.opacity = '0';
    lbTrack.style.opacity = '0';
    document.body.style.overflow = 'hidden';

    // Set up the slide position now while hidden
    goToSlide(index, false);
    lbTrack.style.transform = `translateX(${-1 * window.innerWidth}px) translateY(0)`;

    // Force reflow
    morphClone.offsetHeight;

    // Calculate target position
    const ar = currentPhotos[index].width / currentPhotos[index].height;
    let targetW, targetH;
    const maxW = window.innerWidth * 0.9;
    const maxH = window.innerHeight * 0.9;

    if (maxW / maxH > ar) {
      targetH = maxH;
      targetW = targetH * ar;
    } else {
      targetW = maxW;
      targetH = targetW / ar;
    }

    const targetL = (window.innerWidth - targetW) / 2;
    const targetT = (window.innerHeight - targetH) / 2;

    // Use requestAnimationFrame for smooth animation start
    requestAnimationFrame(() => {
      morphClone.style.transition = 'left 0.3s cubic-bezier(0.2, 0, 0, 1), top 0.3s cubic-bezier(0.2, 0, 0, 1), width 0.3s cubic-bezier(0.2, 0, 0, 1), height 0.3s cubic-bezier(0.2, 0, 0, 1)';
      morphClone.style.left = targetL + 'px';
      morphClone.style.top = targetT + 'px';
      morphClone.style.width = targetW + 'px';
      morphClone.style.height = targetH + 'px';

      lightbox.style.transition = 'opacity 0.2s ease';
      lightbox.style.opacity = '1';
    });

    // Preload the full-res image so we don't flash black
    const fullImg = virtualSlides[1]?.querySelector('img');
    const openClone = morphClone; // capture reference for cleanup
    const revealLightbox = () => {
      // Guard: if lightbox was closed before image loaded, just clean up
      if (!lightbox.classList.contains('active')) {
        if (openClone && openClone.parentNode) openClone.remove();
        return;
      }
      lbTrack.style.opacity = '1';
      lightbox.style.transition = '';

      if (openClone && openClone.parentNode) {
        openClone.remove();
      }
      if (morphClone === openClone) morphClone = null;

      if (window.innerWidth > 768) {
        lbPrev.style.display = currentIndex === 0 ? 'none' : 'block';
        lbNext.style.display = currentIndex === currentPhotos.length - 1 ? 'none' : 'block';
      }
    };

    // Wait for both the morph animation (320ms) and the full-res image to load
    const morphDone = new Promise(r => setTimeout(r, 320));
    const imgLoaded = new Promise(r => {
      if (fullImg && fullImg.complete && fullImg.naturalWidth > 0) {
        r();
      } else if (fullImg) {
        fullImg.onload = r;
        fullImg.onerror = r;
        // Safety timeout — don't wait forever
        setTimeout(r, 3000);
      } else {
        r();
      }
    });

    Promise.all([morphDone, imgLoaded]).then(revealLightbox);

  } else {
    // No source — instant open (e.g. keyboard or programmatic)
    goToSlide(index, false);
    lightbox.classList.add('active');
    lightbox.style.opacity = '1';
    lbTrack.style.transform = `translateX(${-1 * window.innerWidth}px) translateY(0)`;
    document.body.style.overflow = 'hidden';

    if (window.innerWidth > 768) {
      lbPrev.style.display = currentIndex === 0 ? 'none' : 'block';
      lbNext.style.display = currentIndex === currentPhotos.length - 1 ? 'none' : 'block';
    }
  }
}

function closeLightbox() {
  resetZoom();

  // Clean up any leftover morph clone from open animation
  if (morphClone && morphClone.parentNode) {
    morphClone.remove();
    morphClone = null;
  }

  // If we have a morph source, animate back
  if (morphSource && morphRect) {
    const slideImg = getCurrentSlideImg();

    // Create clone at current lightbox position
    morphClone = document.createElement('div');
    morphClone.className = 'morph-clone';

    const lbImg = slideImg || null;
    let startRect;
    if (lbImg) {
      startRect = lbImg.getBoundingClientRect();
    } else {
      startRect = { left: window.innerWidth * 0.05, top: window.innerHeight * 0.05, width: window.innerWidth * 0.9, height: window.innerHeight * 0.9 };
    }

    morphClone.style.cssText = `
      position: fixed;
      left: ${startRect.left}px;
      top: ${startRect.top}px;
      width: ${startRect.width}px;
      height: ${startRect.height}px;
      z-index: 1002;
      overflow: hidden;
      will-change: transform;
    `;

    const cloneImg = document.createElement('img');
    cloneImg.src = morphSource.src || currentPhotos[currentIndex].grid;
    cloneImg.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    morphClone.appendChild(cloneImg);
    document.body.appendChild(morphClone);

    // Hide lightbox immediately
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
    lightbox.style.background = '';
    lightbox.style.opacity = '';
    lbTrack.style.opacity = '';

    // Get fresh grid position (might have scrolled)
    const freshRect = morphSource.getBoundingClientRect();

    // Use rAF for smooth start
    requestAnimationFrame(() => {
      morphClone.style.transition = 'left 0.25s cubic-bezier(0.2, 0, 0, 1), top 0.25s cubic-bezier(0.2, 0, 0, 1), width 0.25s cubic-bezier(0.2, 0, 0, 1), height 0.25s cubic-bezier(0.2, 0, 0, 1)';
      morphClone.style.left = freshRect.left + 'px';
      morphClone.style.top = freshRect.top + 'px';
      morphClone.style.width = freshRect.width + 'px';
      morphClone.style.height = freshRect.height + 'px';
    });

    setTimeout(() => {
      if (morphSource) morphSource.style.opacity = '';
      if (morphClone && morphClone.parentNode) {
        morphClone.remove();
        morphClone = null;
      }
      morphSource = null;
      morphRect = null;
    }, 270);

  } else {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
    lightbox.style.background = '';
    lightbox.style.opacity = '';
    lbTrack.style.opacity = '';
    morphSource = null;
    morphRect = null;
  }
}

// ============================================
// Lightbox controls
// ============================================
lbClose.addEventListener('click', closeLightbox);
lbPrev.addEventListener('click', () => {
  if (currentIndex > 0) goToSlide(currentIndex - 1);
});
lbNext.addEventListener('click', () => {
  if (currentIndex < currentPhotos.length - 1) goToSlide(currentIndex + 1);
});

// Click/double-click handling for lightbox
let lbClickTimer = null;
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox || e.target.classList.contains('lb-slide')) {
    // If zoomed, single click shouldn't close — just reset zoom
    if (zoomScale > 1) {
      return;
    }
    // Delay close to detect double-click
    if (lbClickTimer) return;
    lbClickTimer = setTimeout(() => {
      lbClickTimer = null;
      closeLightbox();
    }, 250);
  }
});

lightbox.addEventListener('dblclick', (e) => {
  if (!(e.target === lightbox || e.target.classList.contains('lb-slide'))) return;
  // Cancel the pending single-click close
  if (lbClickTimer) { clearTimeout(lbClickTimer); lbClickTimer = null; }
  const img = getCurrentSlideImg();
  if (!img) return;
  e.preventDefault();
  if (zoomScale > 1) {
    resetZoom();
  } else {
    zoomScale = 2.5;
    panOffsetX = (window.innerWidth / 2 - e.clientX) * (zoomScale - 1);
    panOffsetY = (window.innerHeight / 2 - e.clientY) * (zoomScale - 1);
    clampPan();
    img.style.transition = 'transform 0.3s ease';
    applyZoom(img);
    setTimeout(() => { img.style.transition = ''; }, 300);
  }
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('active')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft' && currentIndex > 0) goToSlide(currentIndex - 1);
  if (e.key === 'ArrowRight' && currentIndex < currentPhotos.length - 1) goToSlide(currentIndex + 1);
});

// ============================================
// Trackpad/wheel gesture handling for lightbox
// ============================================
let isWheeling = false;
let wheelDeltaX = 0;
let wheelDeltaY = 0;
let wheelTimeout = null;
let wheelDirection = null;
let wheelVelocity = 0;
let lastWheelTime = 0;

lightbox.addEventListener('wheel', (e) => {
  if (!lightbox.classList.contains('active')) return;
  e.preventDefault();

  // Trackpad pinch-to-zoom (ctrlKey is set for pinch gestures on Mac)
  if (e.ctrlKey) {
    const img = getCurrentSlideImg();
    if (!img) return;

    const prevScale = zoomScale;
    // Exponential scaling for smooth continuous zoom
    zoomScale = Math.max(1, Math.min(zoomScale * Math.exp(-e.deltaY * 0.005), MAX_ZOOM));

    // Zoom toward cursor position
    const rect = img.getBoundingClientRect();
    const cx = e.clientX - (rect.left + rect.width / 2);
    const cy = e.clientY - (rect.top + rect.height / 2);
    const scaleFactor = zoomScale / prevScale;
    panOffsetX = cx - scaleFactor * (cx - panOffsetX);
    panOffsetY = cy - scaleFactor * (cy - panOffsetY);

    clampPan();
    img.style.transition = 'none';
    applyZoom(img);
    return;
  }

  // If zoomed in, pan with two-finger scroll
  if (zoomScale > 1) {
    const img = getCurrentSlideImg();
    if (!img) return;
    panOffsetX -= e.deltaX * 1.5;
    panOffsetY -= e.deltaY * 1.5;
    clampPan();
    img.style.transition = 'none';
    applyZoom(img);
    return;
  }

  const now = Date.now();
  const timeDelta = now - lastWheelTime;
  lastWheelTime = now;

  if (!isWheeling) {
    isWheeling = true;
    wheelDeltaX = 0;
    wheelDeltaY = 0;
    wheelDirection = null;
  }

  if (!wheelDirection) {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      wheelDirection = 'horizontal';
    } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      wheelDirection = 'vertical';
    }
  }

  // Vertical swiping to dismiss (swipe down only)
  if (wheelDirection === 'vertical') {
    wheelDeltaY += e.deltaY;

    // Two fingers drag down = negative deltaY on this Mac
    if (wheelDeltaY < 0) {
      const absDelta = Math.abs(wheelDeltaY);
      const progress = Math.min(absDelta / 300, 1);
      const opacity = 1 - (progress * 0.5);
      const currentOffset = -1 * window.innerWidth;
      lbTrack.style.transition = 'none';
      lbTrack.style.transform = `translateX(${currentOffset}px) translateY(${absDelta}px)`;
      lightbox.style.background = `rgba(255, 255, 255, ${0.7 * opacity})`;
    }

    if (wheelTimeout) clearTimeout(wheelTimeout);

    wheelTimeout = setTimeout(() => {
      const shouldDismiss = wheelDeltaY < -150;

      if (shouldDismiss) {
        // Clear morph source and any leftover clone
        if (morphSource) morphSource.style.opacity = '';
        morphSource = null;
        morphRect = null;
        if (morphClone && morphClone.parentNode) { morphClone.remove(); morphClone = null; }

        lbTrack.style.transition = 'transform 0.2s ease-out';
        lightbox.style.transition = 'background 0.2s ease-out';
        lbTrack.style.transform = `translateX(${-1 * window.innerWidth}px) translateY(${window.innerHeight}px)`;
        lightbox.style.background = 'rgba(255, 255, 255, 0)';
        setTimeout(() => {
          // Direct teardown — no closeLightbox to avoid pop-back
          resetZoom();
          lightbox.classList.remove('active');
          document.body.style.overflow = '';
          lightbox.style.background = '';
          lightbox.style.opacity = '';
          lightbox.style.transition = '';
          lbTrack.style.opacity = '';
          lbTrack.style.transition = 'none';
          lbTrack.style.transform = `translateX(${-1 * window.innerWidth}px) translateY(0)`;
        }, 210);
      } else {
        lbTrack.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        lightbox.style.transition = 'background 0.3s ease';
        const currentOffset = -1 * window.innerWidth;
        lbTrack.style.transform = `translateX(${currentOffset}px) translateY(0)`;
        lightbox.style.background = '';
        wheelDeltaY = 0;
      }

      isWheeling = false;
      wheelDirection = null;
    }, 30);

    return;
  }

  // Horizontal swiping for navigation
  if (wheelDirection === 'horizontal') {
    const isAtStart = currentIndex === 0 && e.deltaX < 0;
    const isAtEnd = currentIndex === currentPhotos.length - 1 && e.deltaX > 0;

    if (!isAtStart && !isAtEnd) {
      wheelDeltaX += e.deltaX;
    }

    if (timeDelta > 0) {
      wheelVelocity = e.deltaX / timeDelta;
    }

    const baseOffset = -1 * window.innerWidth;
    lbTrack.style.transform = `translateX(${baseOffset - wheelDeltaX}px)`;

    if (wheelTimeout) clearTimeout(wheelTimeout);

    wheelTimeout = setTimeout(() => {
      const threshold = window.innerWidth * 0.1;
      const shouldChange = Math.abs(wheelDeltaX) > threshold || Math.abs(wheelVelocity) > 0.3;

      lbTrack.style.transition = 'transform 0.11s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

      if (shouldChange && wheelDeltaX > 0 && currentIndex < currentPhotos.length - 1) {
        goToSlide(currentIndex + 1);
      } else if (shouldChange && wheelDeltaX < 0 && currentIndex > 0) {
        goToSlide(currentIndex - 1);
      } else {
        lbTrack.style.transform = `translateX(${baseOffset}px)`;
      }

      wheelDeltaX = 0;
      wheelVelocity = 0;
      isWheeling = false;
      wheelDirection = null;
    }, 60);
  }
}, { passive: false });

// ============================================
// Touch gesture handling for lightbox
// ============================================
let touchStartX = 0;
let touchStartY = 0;
let touchCurrentX = 0;
let touchCurrentY = 0;
let isDragging = false;
let startTime = 0;
let baseOffset = 0;
let gestureDirection = null;

// Pinch-to-zoom state
let isPinching = false;
let zoomScale = 1;
let initialPinchDist = 0;
let initialPinchScale = 1;
let panStartX = 0;
let panStartY = 0;
let panOffsetX = 0;
let panOffsetY = 0;
let lastPanX = 0;
let lastPanY = 0;
let lastTapTime = 0;
let pinchJustEnded = false;
let pinchEndTimer = null;
let initialPinchMidX = 0;
let initialPinchMidY = 0;
let lastPinchMidX = 0;
let lastPinchMidY = 0;

const MAX_ZOOM = 4;

function clampPan() {
  if (zoomScale <= 1) {
    panOffsetX = 0;
    panOffsetY = 0;
    return;
  }

  const img = getCurrentSlideImg();
  if (!img || !img.naturalWidth) return;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // CSS constraints: max-width:90%, max-height:90vh, but image won't exceed natural size
  const maxW = Math.min(img.naturalWidth, vw * 0.9);
  const maxH = Math.min(img.naturalHeight, vh * 0.9);
  const ar = img.naturalWidth / img.naturalHeight;

  let baseW, baseH;
  if (maxW / maxH > ar) {
    baseH = maxH;
    baseW = baseH * ar;
  } else {
    baseW = maxW;
    baseH = baseW / ar;
  }

  const maxPanX = Math.max(0, (baseW * zoomScale - vw) / 2);
  const maxPanY = Math.max(0, (baseH * zoomScale - vh) / 2);

  panOffsetX = Math.max(-maxPanX, Math.min(maxPanX, panOffsetX));
  panOffsetY = Math.max(-maxPanY, Math.min(maxPanY, panOffsetY));
}

function getDistance(t1, t2) {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getCurrentSlideImg() {
  if (virtualSlides.length >= 2) {
    return virtualSlides[1].querySelector('img');
  }
  return null;
}

function applyZoom(img) {
  if (zoomScale < 1.01) {
    zoomScale = 1;
    panOffsetX = 0;
    panOffsetY = 0;
    img.style.transform = '';
  } else {
    img.style.transform = `translate(${panOffsetX}px, ${panOffsetY}px) scale(${zoomScale})`;
  }
}

function resetZoom() {
  const img = getCurrentSlideImg();
  if (img) {
    img.style.transition = 'transform 0.3s ease';
    img.style.transform = '';
    setTimeout(() => { img.style.transition = ''; }, 300);
  }
  zoomScale = 1;
  panOffsetX = 0;
  panOffsetY = 0;
}

function setPinchCooldown() {
  pinchJustEnded = true;
  if (pinchEndTimer) clearTimeout(pinchEndTimer);
  pinchEndTimer = setTimeout(() => { pinchJustEnded = false; }, 400);
}

lightbox.addEventListener('touchstart', (e) => {
  if (e.target.closest('.lb-btn')) return;

  // Two-finger pinch start
  if (e.touches.length === 2) {
    isPinching = true;
    isDragging = false;
    gestureDirection = null;
    initialPinchDist = getDistance(e.touches[0], e.touches[1]);
    initialPinchScale = zoomScale;
    initialPinchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    initialPinchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    lastPinchMidX = initialPinchMidX;
    lastPinchMidY = initialPinchMidY;
    return;
  }

  // Skip if pinch just ended (prevents glitch from leftover finger)
  if (pinchJustEnded) return;

  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchCurrentX = touchStartX;
  touchCurrentY = touchStartY;
  startTime = Date.now();
  baseOffset = -1 * window.innerWidth;
  gestureDirection = null;

  // If zoomed, start panning
  if (zoomScale > 1) {
    isDragging = false;
    panStartX = e.touches[0].clientX;
    panStartY = e.touches[0].clientY;
    lastPanX = panOffsetX;
    lastPanY = panOffsetY;
  } else {
    isDragging = true;
    lbTrack.style.transition = 'none';
    lightbox.style.transition = 'none';
  }
}, { passive: false });

lightbox.addEventListener('touchmove', (e) => {
  // Pinch zoom toward finger midpoint + pan-while-pinching
  if (isPinching && e.touches.length === 2) {
    e.preventDefault();
    const img = getCurrentSlideImg();
    if (!img) return;

    const dist = getDistance(e.touches[0], e.touches[1]);
    const prevScale = zoomScale;
    zoomScale = Math.max(1, Math.min(initialPinchScale * (dist / initialPinchDist), MAX_ZOOM));

    // Zoom toward initial pinch center
    const rect = img.getBoundingClientRect();
    const cx = initialPinchMidX - (rect.left + rect.width / 2);
    const cy = initialPinchMidY - (rect.top + rect.height / 2);
    const scaleFactor = zoomScale / prevScale;
    panOffsetX = cx - scaleFactor * (cx - panOffsetX);
    panOffsetY = cy - scaleFactor * (cy - panOffsetY);

    // Pan-while-pinching: track midpoint drift
    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    panOffsetX += midX - lastPinchMidX;
    panOffsetY += midY - lastPinchMidY;
    lastPinchMidX = midX;
    lastPinchMidY = midY;

    img.style.transition = 'none';
    applyZoom(img);
    return;
  }

  // If pinch is active but lost a finger, ignore
  if (isPinching) return;

  // Pan while zoomed (single finger)
  if (zoomScale > 1 && e.touches.length === 1 && !pinchJustEnded) {
    e.preventDefault();
    const dx = e.touches[0].clientX - panStartX;
    const dy = e.touches[0].clientY - panStartY;
    panOffsetX = lastPanX + dx;
    panOffsetY = lastPanY + dy;

    const img = getCurrentSlideImg();
    if (img) {
      img.style.transition = 'none';
      applyZoom(img);
    }
    return;
  }

  // Normal swipe/dismiss (not zoomed)
  if (!isDragging) return;

  touchCurrentX = e.touches[0].clientX;
  touchCurrentY = e.touches[0].clientY;

  const deltaX = touchCurrentX - touchStartX;
  const deltaY = touchCurrentY - touchStartY;

  if (!gestureDirection) {
    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      gestureDirection = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
    } else {
      return;
    }
  }

  if (gestureDirection === 'horizontal') {
    let adjustedDeltaX = deltaX;
    const isAtStart = currentIndex === 0 && deltaX > 0;
    const isAtEnd = currentIndex === currentPhotos.length - 1 && deltaX < 0;

    if (isAtStart || isAtEnd) {
      adjustedDeltaX = deltaX * 0.3;
    }

    lbTrack.style.transform = `translateX(${baseOffset + adjustedDeltaX}px)`;
  } else {
    if (deltaY > 0) {
      const progress = Math.min(deltaY / 300, 1);
      const opacity = 1 - (progress * 0.5);
      const currentOffset = -1 * window.innerWidth;
      lbTrack.style.transform = `translateX(${currentOffset}px) translateY(${deltaY}px)`;
      lightbox.style.background = `rgba(255, 255, 255, ${0.7 * opacity})`;
    }
  }
}, { passive: false });

lightbox.addEventListener('touchend', (e) => {
  // End pinch
  if (isPinching) {
    // Only end pinch when all fingers lifted
    if (e.touches.length === 0) {
      isPinching = false;
      setPinchCooldown();
      if (zoomScale < 1.1) {
        resetZoom();
      } else {
        // Spring-back: clamp pan and animate if position changed
        const oldX = panOffsetX, oldY = panOffsetY;
        clampPan();
        if (oldX !== panOffsetX || oldY !== panOffsetY) {
          const img = getCurrentSlideImg();
          if (img) {
            img.style.transition = 'transform 0.3s ease';
            applyZoom(img);
            setTimeout(() => { img.style.transition = ''; }, 300);
          }
        }
      }
    }
    return;
  }

  // Ignore if in cooldown
  if (pinchJustEnded) return;

  // End pan while zoomed — spring-back if at edge
  if (zoomScale > 1) {
    const oldX = panOffsetX, oldY = panOffsetY;
    clampPan();
    if (oldX !== panOffsetX || oldY !== panOffsetY) {
      const img = getCurrentSlideImg();
      if (img) {
        img.style.transition = 'transform 0.3s ease';
        applyZoom(img);
        setTimeout(() => { img.style.transition = ''; }, 300);
      }
    }
    // Check double-tap even while zoomed (to zoom out)
    const moveDist = Math.abs(touchCurrentX - touchStartX) + Math.abs(touchCurrentY - touchStartY);
    if (moveDist < 15) {
      const now = Date.now();
      if (now - lastTapTime < 300 && lastTapTime > 0) {
        lastTapTime = 0;
        resetZoom();
        return;
      }
      lastTapTime = now;
    } else {
      lastTapTime = 0;
    }
    return;
  }

  // Double-tap detection: only count as tap if minimal movement
  const wasTap = !gestureDirection && Math.abs(touchCurrentX - touchStartX) + Math.abs(touchCurrentY - touchStartY) < 15;

  if (!isDragging) {
    // Still check for double-tap on non-drag touches
    if (wasTap) {
      const now = Date.now();
      if (now - lastTapTime < 300 && lastTapTime > 0) {
        lastTapTime = 0;
        const img = getCurrentSlideImg();
        if (img) {
          zoomScale = 2.5;
          panOffsetX = (window.innerWidth / 2 - touchStartX) * (zoomScale - 1);
          panOffsetY = (window.innerHeight / 2 - touchStartY) * (zoomScale - 1);
          clampPan();
          img.style.transition = 'transform 0.3s ease';
          applyZoom(img);
          setTimeout(() => { img.style.transition = ''; }, 300);
        }
        return;
      }
      lastTapTime = now;
    } else {
      lastTapTime = 0;
    }
    return;
  }
  isDragging = false;

  const deltaX = touchCurrentX - touchStartX;
  const deltaY = touchCurrentY - touchStartY;
  const deltaTime = Date.now() - startTime;

  if (gestureDirection === 'horizontal') {
    const velocity = Math.abs(deltaX) / deltaTime;
    const threshold = window.innerWidth * 0.2;
    const shouldChange = Math.abs(deltaX) > threshold || velocity > 0.5;

    if (shouldChange && deltaX > 0 && currentIndex > 0) {
      goToSlide(currentIndex - 1);
    } else if (shouldChange && deltaX < 0 && currentIndex < currentPhotos.length - 1) {
      goToSlide(currentIndex + 1);
    } else {
      lbTrack.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      lbTrack.style.transform = `translateX(${baseOffset}px)`;
    }
  } else if (gestureDirection === 'vertical' && deltaY > 0) {
    const velocity = deltaY / deltaTime;
    const shouldDismiss = deltaY > 150 || velocity > 0.5;

    if (shouldDismiss) {
      lbTrack.style.transition = 'transform 0.3s ease-out';
      lightbox.style.transition = 'background 0.3s ease-out';
      lbTrack.style.transform = `translateX(${-1 * window.innerWidth}px) translateY(${window.innerHeight}px)`;
      lightbox.style.background = 'rgba(255, 255, 255, 0)';

      setTimeout(() => {
        closeLightbox();
        lbTrack.style.transform = `translateX(${baseOffset}px)`;
      }, 300);
    } else {
      lbTrack.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      lightbox.style.transition = 'background 0.3s ease';
      lbTrack.style.transform = `translateX(${baseOffset}px) translateY(0) scale(1)`;
      lightbox.style.background = '';
    }
  }

  // Only count as a tap for double-tap if there was no real gesture
  if (wasTap) {
    lastTapTime = Date.now();
  } else {
    lastTapTime = 0;
  }

  gestureDirection = null;
});

// ============================================
// Mobile album view swipe-to-close
// ============================================
let mainTouchX = 0;
let mainTouchY = 0;
let mainDragging = false;
let mainDir = null;
let mainTouchMoved = false;
let mainStartTime = 0;

function closeAlbumView() {
  mainEl.classList.remove('active');
  document.querySelectorAll('#albumNav a').forEach(link => link.classList.remove('active'));
  mainEl.style.transform = '';
  mainEl.style.transition = '';
  mainEl.style.opacity = '';
}

mainEl.addEventListener('touchstart', (e) => {
  if (window.innerWidth > 768 || !mainEl.classList.contains('active')) return;
  if (e.target.closest('.mobile-close')) return;

  mainTouchX = e.touches[0].clientX;
  mainTouchY = e.touches[0].clientY;
  mainDragging = true;
  mainDir = null;
  mainTouchMoved = false;
  mainStartTime = Date.now();
}, { passive: true, capture: true });

mainEl.addEventListener('touchmove', (e) => {
  if (!mainDragging) return;
  const x = e.touches[0].clientX;
  const y = e.touches[0].clientY;
  const dx = x - mainTouchX;
  const dy = y - mainTouchY;

  if (!mainDir && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
    mainDir = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    mainTouchMoved = true;
  }

  if (mainDir === 'h' && dx > 0) {
    e.preventDefault();
    e.stopPropagation();
    mainEl.style.transition = 'none';
    mainEl.style.transform = `translateX(${Math.min(dx, window.innerWidth)}px)`;
    mainEl.style.opacity = 1 - (dx / window.innerWidth * 0.3);
  }
}, { passive: false, capture: true });

mainEl.addEventListener('touchend', (e) => {
  if (!mainDragging) return;
  mainDragging = false;

  const dx = e.changedTouches[0].clientX - mainTouchX;
  const deltaTime = Date.now() - mainStartTime;
  const velocity = Math.abs(dx) / deltaTime;

  const shouldClose = mainDir === 'h' && dx > 0 &&
    (dx > window.innerWidth * 0.3 || velocity > 0.5);

  if (mainDir === 'h') {
    e.preventDefault();
    e.stopPropagation();
  }

  mainEl.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s ease';
  if (shouldClose) {
    mainEl.style.transform = `translateX(${window.innerWidth}px)`;
    mainEl.style.opacity = '0';
    setTimeout(closeAlbumView, 300);
  } else if (mainDir === 'h') {
    mainEl.style.transform = 'translateX(0)';
    mainEl.style.opacity = '1';
  }
  mainDir = null;
}, { capture: true });

// ============================================
// Initialization
// ============================================

// Pre-hide sidebar elements on mobile before fetch to prevent flash
const _mobileIntro = window.innerWidth <= 768;
if (_mobileIntro) {
  document.querySelectorAll('.sidebar h1, .sidebar .social, .sidebar .signature, .sidebar .theme-toggle, .sidebar .copyright').forEach(el => {
    el.style.opacity = '0';
  });
}

loadAlbums();

// Debounced resize handler
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (editMode) {
      renderEditGrid();
    } else {
      renderGrid();
    }
  }, 150);
});

// Mobile close button
const mobileClose = document.getElementById('mobileClose');
if (mobileClose) {
  mobileClose.addEventListener('click', closeAlbumView);
}

// ============================================
// Edit Mode: Hidden login + drag reorder + save
// ============================================
let editMode = false;
let mobilePreview = false;
let isUploading = false;
let exitTimer = null;
let nameClickCount = 0;
let nameClickTimer = null;
let preEditAlbums = null;
let pendingMoves = [];
let pendingDeletes = [];

function recordMove(filename, fromFolder, toFolder) {
  // If there's already a pending move for this file, update its destination
  const existing = pendingMoves.find(m => m.file === filename);
  if (existing) {
    existing.to = toFolder;
    // If net effect is no move, remove the entry
    if (existing.from === existing.to) {
      pendingMoves.splice(pendingMoves.indexOf(existing), 1);
    }
  } else {
    pendingMoves.push({ file: filename, from: fromFolder, to: toFolder });
  }
}

const REPO_OWNER = 'rywb45';
const REPO_NAME = 'photo-site';

// Double-click name to toggle edit mode
document.querySelector('.sidebar h1').addEventListener('click', () => {
  nameClickCount++;

  if (nameClickTimer) clearTimeout(nameClickTimer);
  nameClickTimer = setTimeout(() => { nameClickCount = 0; }, 400);

  if (nameClickCount >= 2) {
    nameClickCount = 0;
    if (editMode) {
      exitEditMode();
    } else {
      attemptLogin();
    }
  }
});

function attemptLogin() {
  let token = localStorage.getItem('gh_token');

  if (token) {
    enterEditMode();
    return;
  }

  // Show custom login modal
  const backdrop = document.createElement('div');
  backdrop.className = 'login-modal-backdrop';
  backdrop.innerHTML = `
    <div class="login-modal">
      <div class="login-modal-title">GitHub Token</div>
      <input type="password" class="login-modal-input" placeholder="Personal Access Token" autocomplete="off" spellcheck="false">
      <div class="login-modal-buttons">
        <button class="login-modal-btn login-modal-cancel">CANCEL</button>
        <button class="login-modal-btn login-modal-submit">SUBMIT</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const input = backdrop.querySelector('.login-modal-input');
  const cancelBtn = backdrop.querySelector('.login-modal-cancel');
  const submitBtn = backdrop.querySelector('.login-modal-submit');

  requestAnimationFrame(() => input.focus());

  function dismiss() {
    backdrop.remove();
  }

  function submit() {
    const val = input.value.trim();
    if (!val) return;
    localStorage.setItem('gh_token', val);
    dismiss();
    enterEditMode();
  }

  cancelBtn.addEventListener('click', dismiss);
  submitBtn.addEventListener('click', submit);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) dismiss();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') dismiss();
  });
}

function enterEditMode() {
  // Cancel any pending exit cleanup from a previous session
  if (exitTimer) { clearTimeout(exitTimer); exitTimer = null; }

  editMode = true;
  document.body.classList.add('edit-mode');

  // Clear stale upload previews from any previous session
  unsortedPreviews.clear();

  // Snapshot current state for cancel
  preEditAlbums = JSON.parse(JSON.stringify(albums));

  // INSTANT: activate edit mode
  rebuildAlbumNav();
  renderEditGrid();
  setupEditSidebar();
  showEditBar();

  // DECORATIVE: typewriter animation
  const nameText = document.getElementById('nameText');
  const cursor = document.getElementById('editCursor');
  cursor.classList.add('blinking');
  playTypewriterIn(nameText);
}

function setupEditSidebar() {
  // Clean up previous handlers before adding new ones
  const nav = document.getElementById('albumNav');
  if (nav._editCleanup) { nav._editCleanup(); nav._editCleanup = null; }

  const navLinks = Array.from(document.querySelectorAll('#albumNav a'));
  let handlers = [];

  navLinks.forEach((link, i) => {
    const albumName = link.dataset.album;
    link.classList.add('edit-album-link');

    const handler = (e) => {
      if (e.button !== 0 || !editMode) return;
      e.preventDefault();
      e.stopPropagation();

      const startY = e.clientY;
      const startX = e.clientX;
      let hasDragged = false;
      let clone = null;
      let mouseY = startY;
      let currentHoverIdx = -1;

      const rect = link.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const myIdx = navLinks.indexOf(link);

      const linkRects = navLinks.map(l => {
        const r = l.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, cy: r.top + r.height / 2, h: r.height };
      });

      // Pre-set transitions on all other links for smooth pushing
      navLinks.forEach((l, j) => {
        if (j !== myIdx) {
          l.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)';
        }
      });

      function updatePush() {
        let hoverIdx = -1;

        // Find which slot the cursor is over
        for (let j = 0; j < linkRects.length; j++) {
          if (j === myIdx) continue;
          if (mouseY >= linkRects[j].top - 5 && mouseY <= linkRects[j].bottom + 5) {
            hoverIdx = j;
            break;
          }
        }

        if (hoverIdx === currentHoverIdx) return;
        currentHoverIdx = hoverIdx;

        const itemH = linkRects[myIdx].h + 8; // height + gap

        navLinks.forEach((other, j) => {
          if (j === myIdx) return;

          if (hoverIdx === -1) {
            other.style.transform = '';
          } else if (myIdx < hoverIdx) {
            // Dragging down: items between myIdx+1 and hoverIdx shift up
            if (j > myIdx && j <= hoverIdx) {
              other.style.transform = `translateY(-${itemH}px)`;
            } else {
              other.style.transform = '';
            }
          } else {
            // Dragging up: items between hoverIdx and myIdx-1 shift down
            if (j >= hoverIdx && j < myIdx) {
              other.style.transform = `translateY(${itemH}px)`;
            } else {
              other.style.transform = '';
            }
          }
        });
      }

      function onMove(ev) {
        mouseY = ev.clientY;
        const dist = Math.sqrt(Math.pow(ev.clientX - startX, 2) + Math.pow(mouseY - startY, 2));

        if (!hasDragged && dist < 8) return;

        if (!hasDragged) {
          hasDragged = true;
          clone = document.createElement('div');
          clone.textContent = link.textContent;
          clone.style.cssText = `
            position: fixed;
            left: ${rect.left}px;
            top: 0;
            pointer-events: none;
            z-index: 10001;
            opacity: 0.7;
            font-size: ${getComputedStyle(link).fontSize};
            font-weight: ${getComputedStyle(link).fontWeight};
            letter-spacing: ${getComputedStyle(link).letterSpacing};
            text-transform: uppercase;
            color: ${getComputedStyle(link).color};
            will-change: transform;
            white-space: nowrap;
          `;
          document.body.appendChild(clone);
          link.classList.add('edit-album-dragging');
        }

        clone.style.transform = `translateY(${mouseY - offsetY}px)`;
        updatePush();
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);

        if (clone) { clone.remove(); clone = null; }
        link.classList.remove('edit-album-dragging');

        // Clear all transforms and transitions
        navLinks.forEach(l => { l.style.transition = ''; l.style.transform = ''; });

        if (hasDragged && currentHoverIdx !== -1 && currentHoverIdx !== myIdx) {
          // Reorder - only visible albums
          const keys = Object.keys(albums).filter(n => n !== '_unsorted');
          const name = keys[myIdx];
          keys.splice(myIdx, 1);
          keys.splice(currentHoverIdx, 0, name);

          // Rebuild with _unsorted preserved
          const newAlbums = {};
          keys.forEach(k => { newAlbums[k] = albums[k]; });
          if (albums._unsorted) newAlbums._unsorted = albums._unsorted;
          albums = newAlbums;

          rebuildAlbumNav();
          setupEditSidebar();
        } else if (!hasDragged) {
          switchAlbum(albumName);
          if (editMode) setupEditSidebar();
        }
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };

    link.addEventListener('mousedown', handler);
    handlers.push({ link, handler });
  });

  nav._editCleanup = () => {
    handlers.forEach(({ link, handler }) => {
      link.removeEventListener('mousedown', handler);
      link.classList.remove('edit-album-link');
    });
  };
}

function movePhotoToAlbum(photoIndex, targetAlbum) {
  if (targetAlbum === currentAlbum) return;

  const photo = currentPhotos[photoIndex];

  // Get original paths (keep them as-is so the image still displays)
  const fullPath = photo.full.replace('photos/', '');
  const gridPath = photo.grid.replace('photos/', '');
  const filename = fullPath.split('/').pop();
  const srcFolder = fullPath.split('/')[0];

  // Find target album's folder prefix for the move record
  const targetPhotos = albums[targetAlbum];
  let targetFolderPrefix = targetAlbum === '_unsorted' ? 'unsorted' : targetAlbum;
  if (targetPhotos && targetPhotos.length > 0) {
    targetFolderPrefix = targetPhotos[0].src.split('/')[0];
  }

  // Record the move (update existing entry if file was already moved)
  recordMove(filename, srcFolder, targetFolderPrefix);

  // Keep original src/grid paths so images still load correctly
  // The upload script will move the actual files and re-generate photos.json
  const newPhotoData = {
    src: fullPath,
    grid: gridPath,
    w: photo.width,
    h: photo.height
  };

  // Remove from current album
  currentPhotos.splice(photoIndex, 1);
  syncCurrentAlbum();

  // Add to target album (with original paths)
  if (!albums[targetAlbum]) albums[targetAlbum] = [];
  albums[targetAlbum].push(newPhotoData);

  renderEditGrid();
}

function rebuildAlbumNav() {
  const nav = document.getElementById('albumNav');
  nav.innerHTML = '';
  Object.keys(albums).filter(n => n !== '_unsorted').forEach((albumName) => {
    const link = document.createElement('a');
    link.dataset.album = albumName;

    const nameSpan = document.createElement('span');
    nameSpan.textContent = albumName.toUpperCase();
    link.appendChild(nameSpan);

    if (editMode) {
      const actions = document.createElement('span');
      actions.className = 'album-actions';

      const renameBtn = document.createElement('button');
      renameBtn.className = 'album-action-btn';
      renameBtn.innerHTML = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5L10.5 4 4 10.5 1 11l.5-3z"/></svg>';
      renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        renameAlbum(albumName);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'album-action-btn delete';
      deleteBtn.innerHTML = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg>';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        deleteAlbum(albumName);
      });

      actions.appendChild(renameBtn);
      actions.appendChild(deleteBtn);
      link.appendChild(actions);
    }

    if (albumName === currentAlbum) link.classList.add('active');
    link.addEventListener('click', (e) => {
      e.preventDefault();
      switchAlbum(albumName);
      if (editMode) setupEditSidebar();
    });
    nav.appendChild(link);
  });

  // Add "new album" button in edit mode
  if (editMode) {
    const extras = document.createElement('div');
    extras.className = 'edit-album-extras';

    const sep = document.createElement('div');
    sep.className = 'add-album-separator';
    extras.appendChild(sep);

    const addBtn = document.createElement('button');
    addBtn.className = 'add-album-btn';
    addBtn.textContent = '+ NEW ALBUM';
    addBtn.addEventListener('click', () => createAlbum());
    extras.appendChild(addBtn);

    nav.appendChild(extras);

    // Animate in after a frame
    requestAnimationFrame(() => {
      extras.classList.add('visible');
    });
  }
}

// ============================================
// Album Management: Create, Rename, Delete
// ============================================
const RESERVED_ALBUM_NAMES = ['_unsorted', 'photos', 'grid'];

function sanitizeAlbumKey(name) {
  let key = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  key = key.replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
  if (!key || RESERVED_ALBUM_NAMES.includes(key)) return '';
  return key;
}
function createAlbum() {
  const addBtn = document.querySelector('.add-album-btn');
  if (!addBtn) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'inline-rename-row';

  const input = document.createElement('input');
  input.className = 'inline-rename-input';
  input.value = '';
  input.placeholder = 'ALBUM NAME';

  const hint = document.createElement('span');
  hint.className = 'inline-rename-hint';
  hint.textContent = 'enter · esc';

  wrapper.appendChild(input);
  wrapper.appendChild(hint);
  addBtn.replaceWith(wrapper);
  input.focus();

  function commit() {
    const name = input.value.trim();
    if (!name) { revert(); return; }

    const key = sanitizeAlbumKey(name);
    if (!key) { revert(); return; }
    if (albums[key]) {
      input.style.borderColor = '#d44';
      return;
    }

    albums[key] = [];
    rebuildAlbumNav();
    setupEditSidebar();
    switchAlbum(key);
  }

  function revert() {
    rebuildAlbumNav();
    setupEditSidebar();
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') revert();
  });
  input.addEventListener('blur', () => {
    // Small delay to allow for click elsewhere
    setTimeout(() => { if (wrapper.isConnected) revert(); }, 150);
  });
}

function renameAlbum(oldName) {
  const nav = document.getElementById('albumNav');
  const link = nav.querySelector(`a[data-album="${oldName}"]`);
  if (!link) return;

  const nameSpan = link.querySelector('span:first-child');
  const actions = link.querySelector('.album-actions');
  if (actions) actions.style.display = 'none';

  const wrapper = document.createElement('span');
  wrapper.className = 'inline-rename-col';

  const input = document.createElement('input');
  input.className = 'inline-rename-input glow';
  input.value = oldName.toUpperCase();

  const hint = document.createElement('span');
  hint.className = 'inline-rename-hint';
  hint.textContent = 'enter · esc';

  wrapper.appendChild(input);
  wrapper.appendChild(hint);
  nameSpan.replaceWith(wrapper);
  input.focus();
  input.select();

  function commit() {
    const newName = input.value.trim();
    if (!newName || newName.toLowerCase() === oldName) { revert(); return; }

    const newKey = sanitizeAlbumKey(newName);
    if (!newKey) { revert(); return; }
    if (albums[newKey]) {
      input.style.borderColor = '#d44';
      return;
    }

    const newAlbums = {};
    for (const [key, val] of Object.entries(albums)) {
      if (key === oldName) {
        newAlbums[newKey] = val;
      } else {
        newAlbums[key] = val;
      }
    }
    albums = newAlbums;

    if (currentAlbum === oldName) {
      currentAlbum = newKey;
    }

    rebuildAlbumNav();
    setupEditSidebar();
  }

  function revert() {
    wrapper.replaceWith(nameSpan);
    if (actions) actions.style.display = '';
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') revert();
  });
  input.addEventListener('blur', () => {
    setTimeout(() => { if (wrapper.isConnected) revert(); }, 150);
  });

  link.addEventListener('click', (e) => {
    if (wrapper.isConnected) e.preventDefault();
  }, { capture: true });
}

function deleteAlbum(albumName) {
  const photos = albums[albumName] || [];

  // Move photos to _unsorted
  if (photos.length > 0) {
    albums._unsorted = albums._unsorted || [];
    photos.forEach(p => {
      const filename = p.src.split('/').pop();
      const srcFolder = p.src.split('/')[0];
      recordMove(filename, srcFolder, 'unsorted');
      albums._unsorted.push({...p});
    });
  }

  // Remove album
  delete albums[albumName];

  // If we just deleted the current album, switch to first available
  if (currentAlbum === albumName) {
    currentAlbum = null;
    currentPhotos = [];
    const remaining = Object.keys(albums).filter(n => n !== '_unsorted');
    if (remaining.length > 0) {
      switchAlbum(remaining[0]);
    } else {
      currentAlbum = null;
      currentPhotos = [];
      document.getElementById('grid').innerHTML = '';
    }
  }

  rebuildAlbumNav();
  setupEditSidebar();
  renderUnsortedTray();
}

function exitEditMode(saved) {
  editMode = false;
  mobilePreview = false;
  document.body.classList.remove('mobile-preview');

  const grid = document.getElementById('grid');
  if (grid._editCleanup) {
    grid._editCleanup();
    grid._editCleanup = null;
  }

  // Clean up sidebar drag handlers
  const nav = document.getElementById('albumNav');
  if (nav._editCleanup) {
    nav._editCleanup();
    nav._editCleanup = null;
  }

  // Animate bar out
  const bar = document.getElementById('editBar');
  if (bar) {
    bar.classList.remove('visible');
    setTimeout(() => bar.remove(), 350);
  }

  // Remove tray
  const tray = document.getElementById('unsortedTray');
  if (tray) tray.remove();

  // Animate out the add-album extras (keep edit-mode class so layout stays stable)
  const extras = document.querySelector('.edit-album-extras');
  if (extras) extras.classList.remove('visible');

  // Fade out album action kebabs
  document.querySelectorAll('.album-actions').forEach(a => {
    a.style.transition = 'opacity 0.3s ease';
    a.style.opacity = '0';
  });

  // Store what we need for the delayed rebuild
  const wasCancelled = !saved && preEditAlbums;
  const savedPreEditAlbums = preEditAlbums;

  // Delay rebuild to let animations finish, THEN remove edit-mode class
  exitTimer = setTimeout(() => {
    exitTimer = null;
    document.body.classList.remove('edit-mode');

    // If cancelled, restore original order (but keep any uploads since they're already on GitHub)
    if (wasCancelled) {
      // Collect photos that were actually uploaded this session (tracked by unsortedPreviews)
      const uploadedSrcs = new Set();
      for (const [albumName, photos] of Object.entries(albums)) {
        for (const p of photos) {
          if (unsortedPreviews.has(p.grid)) {
            uploadedSrcs.add(p.src);
          }
        }
      }

      // Find uploaded photos wherever they ended up (may have been moved from _unsorted to an album)
      const uploadedByAlbum = {};
      if (uploadedSrcs.size > 0) {
        for (const [albumName, photos] of Object.entries(albums)) {
          const uploaded = photos.filter(p => uploadedSrcs.has(p.src));
          if (uploaded.length > 0) {
            uploadedByAlbum[albumName] = uploaded;
          }
        }
      }

      albums = savedPreEditAlbums;

      // Re-add only genuinely uploaded photos
      for (const [albumName, photos] of Object.entries(uploadedByAlbum)) {
        if (!albums[albumName]) albums[albumName] = [];
        albums[albumName].push(...photos);
      }

      if (currentAlbum && albums[currentAlbum]) {
        currentPhotos = albums[currentAlbum].map(p => ({
          full: `photos/${p.src}`,
          grid: `photos/${p.grid}`,
          width: p.w,
          height: p.h
        }));
      }
    }

    rebuildAlbumNav();
    renderGrid();
  }, 400);

  preEditAlbums = null;
  pendingMoves = [];
  pendingDeletes = [];
  unsortedPreviews.clear();

  // DECORATIVE: typewriter out
  const nameText = document.getElementById('nameText');
  playTypewriterOut(nameText);
}

function playTypewriterIn(el) {
  const original = 'Ryan Byrne';
  let i = original.length;

  let eraseInterval = setInterval(() => {
    if (!editMode) { clearInterval(eraseInterval); el.textContent = original; return; }
    i--;
    if (i < 0) {
      clearInterval(eraseInterval);
      let j = 0;
      let typeInterval = setInterval(() => {
        if (!editMode) { clearInterval(typeInterval); el.textContent = original; return; }
        if (j >= original.length) {
          clearInterval(typeInterval);
          return;
        }
        el.textContent = original.substring(0, j + 1);
        j++;
      }, 35);
      return;
    }
    el.textContent = original.substring(0, i);
  }, 35);
}

function playTypewriterOut(el) {
  const original = 'Ryan Byrne';
  let i = original.length;

  let eraseInterval = setInterval(() => {
    i--;
    if (i < 0) {
      clearInterval(eraseInterval);
      let j = 0;
      let typeBack = setInterval(() => {
        if (j >= original.length) {
          clearInterval(typeBack);
          const cursor = document.getElementById('editCursor');
          cursor.classList.remove('blinking');
          return;
        }
        el.textContent = original.substring(0, j + 1);
        j++;
      }, 35);
      return;
    }
    el.textContent = original.substring(0, i);
  }, 35);
}

function renderEditGrid() {
  const grid = document.getElementById('grid');

  // Clean up previous edit handlers before rebuilding
  if (grid._editCleanup) {
    grid._editCleanup();
    grid._editCleanup = null;
  }

  renderGrid();

  // Add drag-and-drop file upload zone
  function handleDragOver(e) {
    if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      grid.classList.add('edit-drop-active');
    }
  }

  function handleDragLeave(e) {
    if (!grid.contains(e.relatedTarget)) {
      grid.classList.remove('edit-drop-active');
    }
  }

  function handleDrop(e) {
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      grid.classList.remove('edit-drop-active');
      handlePhotoUpload({ target: { files: e.dataTransfer.files, value: '' } });
    }
  }

  if (editMode) {
    grid.addEventListener('dragover', handleDragOver);
    grid.addEventListener('dragleave', handleDragLeave);
    grid.addEventListener('drop', handleDrop);
  }

  const items = Array.from(grid.querySelectorAll('.grid-item'));
  let dragSrcIndex = null;
  let isDragging = false;
  let mouseX = 0, mouseY = 0;
  let startX = 0, startY = 0;
  let clone = null;
  let rafId = null;
  let itemRects = [];

  // Touch drag state
  let touchLongPressTimer = null;
  let touchDragActive = false;
  let touchStartX = 0, touchStartY = 0;
  let touchLongPressItem = null;
  let touchLongPressIndex = null;

  // Cached DOM refs for drag loop (avoid per-frame getElementById)
  let cachedNavLinks = null;
  let cachedUnsortedBtn = null;
  let cachedUnsortedTray = null;

  function refreshDragCaches() {
    cachedNavLinks = document.querySelectorAll('#albumNav a');
    cachedUnsortedBtn = document.getElementById('unsortedBtn');
    cachedUnsortedTray = document.getElementById('unsortedTray');
  }
  refreshDragCaches();

  function cachePositions() {
    itemRects = items.map(item => {
      const rect = item.getBoundingClientRect();
      return {
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
        w: rect.width,
        h: rect.height
      };
    });
  }

  function startDrag(item, index, x, y) {
    dragSrcIndex = index;
    startX = x;
    startY = y;
    mouseX = x;
    mouseY = y;

    const rect = item.getBoundingClientRect();
    const imgEl = item.querySelector('img');
    const imgSrc = imgEl ? imgEl.src : '';

    clone = document.createElement('div');
    clone._startLeft = rect.left;
    clone._startTop = rect.top;
    clone._offsetX = x - rect.left;
    clone._offsetY = y - rect.top;
    clone._shown = false;
    clone.style.cssText = `
      position: fixed;
      left: 0;
      top: 0;
      width: ${rect.width}px;
      height: ${rect.height}px;
      z-index: 10000;
      pointer-events: none;
      visibility: hidden;
      opacity: 0.85;
      box-shadow: 0 12px 40px rgba(0,0,0,0.4);
      border-radius: 4px;
      overflow: hidden;
      will-change: transform;
      background-image: url('${imgSrc}');
      background-size: cover;
      background-position: center;
      transform: translate(${rect.left}px, ${rect.top}px);
    `;
    document.body.appendChild(clone);

    item.classList.add('edit-dragging');
    isDragging = true;
    cachePositions();
    rafId = requestAnimationFrame(animationLoop);
  }

  function animationLoop() {
    if (!isDragging) return;

    const radius = 300;
    const radiusSq = radius * radius;
    const strength = 50;
    const vpTop = -300;
    const vpBottom = window.innerHeight + 300;

    for (let i = 0; i < items.length; i++) {
      if (i === dragSrcIndex) continue;

      const r = itemRects[i];
      if (!r) continue;

      // Viewport culling — skip items far off screen
      if (r.cy < vpTop || r.cy > vpBottom) continue;

      const dx = r.cx - mouseX;
      const dy = r.cy - mouseY;
      const distSq = dx * dx + dy * dy;
      const item = items[i];

      if (distSq < radiusSq && distSq > 0) {
        const dist = Math.sqrt(distSq);
        const t = 1 - dist / radius;
        const easedT = t * t;
        const force = easedT * strength;
        const angle = Math.atan2(dy, dx);
        const pushX = Math.cos(angle) * force;
        const pushY = Math.sin(angle) * force;
        const scale = 1 - easedT * 0.08;

        item.style.animation = 'none';
        item.style.transition = 'none';
        item.style.transform = `translate(${pushX}px, ${pushY}px) scale(${scale})`;
        item._pushed = true;
      } else {
        if (item._pushed) {
          item._pushed = false;
          item.style.transition = 'transform 0.4s cubic-bezier(0.25, 1.5, 0.4, 1)';
          item.style.transform = '';
          setTimeout(() => {
            item.style.transition = '';
            item.style.animation = '';
          }, 400);
        }
      }
    }

    // Move clone with cursor
    if (clone) {
      const cx = mouseX - clone._offsetX;
      const cy = mouseY - clone._offsetY;

      // Shrink clone when near sidebar or unsorted tray
      const sidebarEdge = 280;
      let scale = 1;
      if (mouseX < sidebarEdge + 100) {
        const t = Math.max(0, Math.min(1, 1 - (mouseX - sidebarEdge + 50) / 150));
        scale = 1 - t * 0.65;
      }
      let trayDist = Infinity;
      if (cachedUnsortedBtn) {
        const r = cachedUnsortedBtn.getBoundingClientRect();
        const cxr = Math.max(r.left, Math.min(r.right, mouseX));
        const cyr = Math.max(r.top, Math.min(r.bottom, mouseY));
        trayDist = Math.sqrt((mouseX - cxr) ** 2 + (mouseY - cyr) ** 2);
      }
      if (cachedUnsortedTray && cachedUnsortedTray.classList.contains('open')) {
        const r = cachedUnsortedTray.getBoundingClientRect();
        const cxr = Math.max(r.left, Math.min(r.right, mouseX));
        const cyr = Math.max(r.top, Math.min(r.bottom, mouseY));
        trayDist = Math.min(trayDist, Math.sqrt((mouseX - cxr) ** 2 + (mouseY - cyr) ** 2));
      }
      if (trayDist < 120) {
        const t = Math.max(0, Math.min(1, 1 - trayDist / 120));
        scale = Math.min(scale, 1 - t * 0.65);
      }

      clone.style.transform = `translate(${cx}px, ${cy}px) scale(${scale})`;
      if (!clone._shown) {
        clone._shown = true;
        clone.style.visibility = 'visible';
      }
    }

    rafId = requestAnimationFrame(animationLoop);
  }

  function findDropTarget() {
    let closest = null;
    let closestDistSq = Infinity;
    const thresholdSq = 350 * 350;

    for (let i = 0; i < items.length; i++) {
      if (i === dragSrcIndex) continue;
      const r = itemRects[i];
      if (!r) continue;

      const dx = r.cx - mouseX;
      const dy = r.cy - mouseY;
      const distSq = dx * dx + dy * dy;

      const withinX = mouseX >= r.cx - r.w / 2 - 40 && mouseX <= r.cx + r.w / 2 + 40;
      const withinY = mouseY >= r.cy - r.h / 2 - 40 && mouseY <= r.cy + r.h / 2 + 40;

      if ((withinX && withinY) || distSq < thresholdSq) {
        if (distSq < closestDistSq) {
          closestDistSq = distSq;
          closest = i;
        }
      }
    }

    return closest;
  }

  items.forEach((item, i) => {
    item.classList.add('edit-item');

    // Remove lightbox click in edit mode
    const img = item.querySelector('img');
    const newImg = img.cloneNode(true);
    img.replaceWith(newImg);
    newImg.style.pointerEvents = 'none';
    newImg.style.userSelect = 'none';

    // Add delete button (sized relative to photo)
    const itemH = parseFloat(item.style.height) || 200;
    const btnSize = Math.max(14, Math.min(30, itemH * 0.08));
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'edit-delete-btn';
    deleteBtn.style.fontSize = `${btnSize}px`;
    deleteBtn.innerHTML = '✕';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();

      // Show inline confirmation overlay
      if (item.querySelector('.edit-delete-confirm')) return;
      const overlay = document.createElement('div');
      overlay.className = 'edit-delete-confirm';
      const labelSize = Math.max(9, Math.min(14, itemH * 0.04));
      overlay.innerHTML = `<span style="font-size:${labelSize}px">DELETE</span>`;
      item.appendChild(overlay);

      const dismiss = () => { if (overlay.parentNode) overlay.remove(); };
      const timer = setTimeout(dismiss, 3000);

      overlay.addEventListener('click', (ev) => {
        ev.stopPropagation();
        clearTimeout(timer);
        overlay.remove();
        deletePhoto(i);
      });
    });
    item.appendChild(deleteBtn);

    // Add unsort button (send back to unsorted)
    const unsortBtn = document.createElement('button');
    unsortBtn.className = 'edit-unsort-btn';
    unsortBtn.style.fontSize = `${btnSize}px`;
    unsortBtn.innerHTML = '↩';
    unsortBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      movePhotoToAlbum(i, '_unsorted');
      renderUnsortedTray();
    });
    item.appendChild(unsortBtn);

    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const downX = e.clientX;
      const downY = e.clientY;
      const downIndex = i;

      function onFirstMove(ev) {
        const dist = Math.sqrt(Math.pow(ev.clientX - downX, 2) + Math.pow(ev.clientY - downY, 2));
        if (dist < 8) return;

        document.removeEventListener('mousemove', onFirstMove);
        startDrag(item, downIndex, downX, downY);
        mouseX = ev.clientX;
        mouseY = ev.clientY;
      }

      function onFirstUp() {
        document.removeEventListener('mousemove', onFirstMove);
        document.removeEventListener('mouseup', onFirstUp);
      }

      document.addEventListener('mousemove', onFirstMove);
      document.addEventListener('mouseup', onFirstUp);
    });

    // Touch: long-press to drag
    item.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const downX = touch.clientX;
      const downY = touch.clientY;
      const downIndex = i;

      touchLongPressItem = item;
      touchLongPressIndex = downIndex;
      touchStartX = downX;
      touchStartY = downY;
      touchDragActive = false;

      item.classList.add('touch-lifting');

      touchLongPressTimer = setTimeout(() => {
        touchDragActive = true;
        item.classList.remove('touch-lifting');
        if (navigator.vibrate) navigator.vibrate(50);
        startDrag(item, downIndex, downX, downY);
      }, 400);
    });
  });

  function onMouseMove(e) {
    if (!isDragging) return;
    mouseX = e.clientX;
    mouseY = e.clientY;

    // Check if hovering over a sidebar album link (cached refs)
    cachedNavLinks.forEach(link => {
      const rect = link.getBoundingClientRect();
      const over = mouseX >= rect.left - 10 && mouseX <= rect.right + 10 &&
                   mouseY >= rect.top - 5 && mouseY <= rect.bottom + 5;
      if (over && link.dataset.album !== currentAlbum) {
        link.classList.add('edit-album-photo-target');
      } else {
        link.classList.remove('edit-album-photo-target');
      }
    });

    // Check if hovering over unsorted button or tray (only when tray is open)
    let overUnsorted = false;
    if (cachedUnsortedTray && cachedUnsortedTray.classList.contains('open')) {
      if (cachedUnsortedBtn) {
        const rect = cachedUnsortedBtn.getBoundingClientRect();
        overUnsorted = mouseX >= rect.left - 10 && mouseX <= rect.right + 10 &&
                       mouseY >= rect.top - 5 && mouseY <= rect.bottom + 5;
      }
      if (!overUnsorted) {
        const rect = cachedUnsortedTray.getBoundingClientRect();
        overUnsorted = mouseX >= rect.left && mouseX <= rect.right &&
                       mouseY >= rect.top && mouseY <= rect.bottom;
      }
    }
    if (cachedUnsortedBtn) cachedUnsortedBtn.classList.toggle('drag-target', overUnsorted);
  }

  function finishDrop() {
    if (!isDragging) return;
    isDragging = false;
    cancelAnimationFrame(rafId);

    // Restore wiggle on all items
    items.forEach((item) => {
      item.style.animation = '';
      item.style.transform = '';
      item.classList.remove('edit-dragging');
    });

    // Remove clone
    if (clone) {
      clone.remove();
      clone = null;
    }

    // Clear highlights
    document.querySelectorAll('#albumNav a').forEach(l => l.classList.remove('edit-album-photo-target'));
    const unsortedBtn = document.getElementById('unsortedBtn');
    if (unsortedBtn) unsortedBtn.classList.remove('drag-target');

    // Check if dropped on unsorted tray (only when tray is open)
    if (dragSrcIndex !== null) {
      const unsortedTray = document.getElementById('unsortedTray');
      let overUnsorted = false;
      if (unsortedTray && unsortedTray.classList.contains('open')) {
        if (unsortedBtn) {
          const rect = unsortedBtn.getBoundingClientRect();
          overUnsorted = mouseX >= rect.left - 10 && mouseX <= rect.right + 10 &&
                         mouseY >= rect.top - 5 && mouseY <= rect.bottom + 5;
        }
        if (!overUnsorted) {
          const rect = unsortedTray.getBoundingClientRect();
          overUnsorted = mouseX >= rect.left && mouseX <= rect.right &&
                         mouseY >= rect.top && mouseY <= rect.bottom;
        }
      }
      if (overUnsorted) {
        movePhotoToAlbum(dragSrcIndex, '_unsorted');
        renderUnsortedTray();
        dragSrcIndex = null;
        return;
      }
    }

    // Check if dropped on a sidebar album link
    const navLinks = document.querySelectorAll('#albumNav a');
    let droppedOnAlbum = null;
    navLinks.forEach(link => {
      const rect = link.getBoundingClientRect();
      const over = mouseX >= rect.left - 10 && mouseX <= rect.right + 10 &&
                   mouseY >= rect.top - 5 && mouseY <= rect.bottom + 5;
      if (over && link.dataset.album !== currentAlbum) {
        droppedOnAlbum = link.dataset.album;
      }
    });

    if (droppedOnAlbum && dragSrcIndex !== null) {
      movePhotoToAlbum(dragSrcIndex, droppedOnAlbum);
      dragSrcIndex = null;
      return;
    }

    // Normal reorder within album
    const dropIndex = findDropTarget();
    if (dropIndex !== null && dropIndex !== dragSrcIndex) {
      const oldRects = items.map(item => item.getBoundingClientRect());

      const temp = currentPhotos[dragSrcIndex];
      currentPhotos.splice(dragSrcIndex, 1);
      currentPhotos.splice(dropIndex, 0, temp);

      renderGrid();

      const newItems = Array.from(document.getElementById('grid').querySelectorAll('.grid-item'));

      newItems.forEach((newItem, newIdx) => {
        let oldIdx;
        if (newIdx < Math.min(dragSrcIndex, dropIndex) || newIdx > Math.max(dragSrcIndex, dropIndex)) {
          oldIdx = newIdx;
        } else if (dragSrcIndex < dropIndex) {
          if (newIdx === dropIndex) {
            oldIdx = dragSrcIndex;
          } else {
            oldIdx = newIdx + 1;
          }
        } else {
          if (newIdx === dropIndex) {
            oldIdx = dragSrcIndex;
          } else {
            oldIdx = newIdx - 1;
          }
        }

        if (oldIdx < oldRects.length && oldIdx !== newIdx) {
          const oldRect = oldRects[oldIdx];
          const newRect = newItem.getBoundingClientRect();
          const dx = oldRect.left - newRect.left;
          const dy = oldRect.top - newRect.top;

          if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            newItem.style.transition = 'none';
            newItem.style.transform = `translate(${dx}px, ${dy}px)`;
            newItem.offsetHeight;

            newItem.style.transition = 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)';
            newItem.style.transform = '';

            newItem.addEventListener('transitionend', function handler() {
              newItem.style.transition = '';
              newItem.style.transform = '';
              newItem.removeEventListener('transitionend', handler);
            });
          }
        }
      });

      setTimeout(() => renderEditGrid(), 370);
    }

    dragSrcIndex = null;
  }

  function onMouseUp(e) {
    finishDrop();
  }

  function onTouchMove(e) {
    if (touchLongPressTimer && !touchDragActive) {
      // Check if finger moved too far — cancel long-press
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      if (dx * dx + dy * dy > 100) { // 10px threshold
        clearTimeout(touchLongPressTimer);
        touchLongPressTimer = null;
        if (touchLongPressItem) touchLongPressItem.classList.remove('touch-lifting');
      }
      return;
    }

    if (!isDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    mouseX = touch.clientX;
    mouseY = touch.clientY;

    // Check sidebar album links (same as onMouseMove)
    cachedNavLinks.forEach(link => {
      const rect = link.getBoundingClientRect();
      const over = mouseX >= rect.left - 10 && mouseX <= rect.right + 10 &&
                   mouseY >= rect.top - 5 && mouseY <= rect.bottom + 5;
      if (over && link.dataset.album !== currentAlbum) {
        link.classList.add('edit-album-photo-target');
      } else {
        link.classList.remove('edit-album-photo-target');
      }
    });

    let overUnsorted = false;
    if (cachedUnsortedTray && cachedUnsortedTray.classList.contains('open')) {
      if (cachedUnsortedBtn) {
        const rect = cachedUnsortedBtn.getBoundingClientRect();
        overUnsorted = mouseX >= rect.left - 10 && mouseX <= rect.right + 10 &&
                       mouseY >= rect.top - 5 && mouseY <= rect.bottom + 5;
      }
      if (!overUnsorted) {
        const rect = cachedUnsortedTray.getBoundingClientRect();
        overUnsorted = mouseX >= rect.left && mouseX <= rect.right &&
                       mouseY >= rect.top && mouseY <= rect.bottom;
      }
    }
    if (cachedUnsortedBtn) cachedUnsortedBtn.classList.toggle('drag-target', overUnsorted);
  }

  function onTouchEnd(e) {
    if (touchLongPressTimer) {
      clearTimeout(touchLongPressTimer);
      touchLongPressTimer = null;
    }
    if (touchLongPressItem) {
      touchLongPressItem.classList.remove('touch-lifting');
      touchLongPressItem = null;
    }

    if (touchDragActive) {
      finishDrop();
      touchDragActive = false;
    }
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);

  grid._editCleanup = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
    grid.removeEventListener('dragover', handleDragOver);
    grid.removeEventListener('dragleave', handleDragLeave);
    grid.removeEventListener('drop', handleDrop);
    cancelAnimationFrame(rafId);
    if (touchLongPressTimer) clearTimeout(touchLongPressTimer);
  };
}

function showEditBar() {
  const bar = document.createElement('div');
  bar.id = 'editBar';
  bar.className = 'edit-bar';

  const unsortedCount = (albums._unsorted || []).length;

  bar.innerHTML = `
    <div class="edit-bar-left">
      <span class="edit-bar-label">EDIT MODE</span>
      <button class="unsorted-btn" id="unsortedBtn" onclick="toggleUnsortedTray()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
        <span class="unsorted-badge" id="unsortedBadge"></span>
      </button>
    </div>
    <div class="edit-bar-actions">
      <button class="edit-bar-btn edit-mobile-btn" id="mobilePreviewBtn" onclick="toggleMobilePreview()" title="Mobile preview">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
          <line x1="12" y1="18" x2="12.01" y2="18"/>
        </svg>
      </button>
      <label class="edit-bar-btn edit-upload-label" title="Upload photos">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <input type="file" id="editUploadInput" accept="image/*" multiple style="display:none">
      </label>
      <button class="edit-bar-btn edit-cancel" onclick="exitEditMode()">CANCEL</button>
      <button class="edit-bar-btn edit-save" onclick="saveOrder()">SAVE</button>
    </div>
  `;
  document.body.appendChild(bar);

  // Build tray
  const tray = document.createElement('div');
  tray.id = 'unsortedTray';
  tray.className = 'unsorted-tray';
  tray.innerHTML = `
    <div class="unsorted-tray-header">
      <span class="unsorted-tray-title">UNSORTED</span>
      <button class="unsorted-tray-close" onclick="toggleUnsortedTray()">×</button>
    </div>
    <div class="unsorted-tray-strip" id="unsortedStrip"></div>
  `;
  document.body.appendChild(tray);
  renderUnsortedTray();

  bar.offsetHeight;
  bar.classList.add('visible');

  // Delay tray visibility so it doesn't flash during edit bar entrance
  setTimeout(() => {
    tray.classList.add('ready');
    // Auto-open tray if there are unsorted photos
    if ((albums._unsorted || []).length > 0) {
      tray.classList.add('open');
      document.getElementById('unsortedBtn').classList.add('active');
    }
  }, 400);

  document.getElementById('editUploadInput').addEventListener('change', handlePhotoUpload);
}

function toggleMobilePreview() {
  mobilePreview = !mobilePreview;
  document.body.classList.toggle('mobile-preview', mobilePreview);
  const btn = document.getElementById('mobilePreviewBtn');
  btn.classList.toggle('active', mobilePreview);
  btn.innerHTML = mobilePreview
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>';
  renderEditGrid();
  document.getElementById('grid').scrollTop = 0;
}

function toggleUnsortedTray() {
  const tray = document.getElementById('unsortedTray');
  const btn = document.getElementById('unsortedBtn');
  if (!tray) return;
  tray.classList.toggle('open');
  btn.classList.toggle('active');
}

function updateUnsortedBadge() {
  const badge = document.getElementById('unsortedBadge');
  if (!badge) return;
  const count = (albums._unsorted || []).length;
  badge.textContent = count;
  badge.classList.toggle('visible', count > 0);
}

function renderUnsortedTray() {
  const strip = document.getElementById('unsortedStrip');
  if (!strip) return;

  const unsorted = albums._unsorted || [];
  strip.innerHTML = '';

  updateUnsortedBadge();

  unsorted.forEach((photo, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'unsorted-thumb';

    const img = document.createElement('img');
    img.src = unsortedPreviews.get(photo.grid) || `photos/${photo.grid}`;
    img.draggable = false;
    img.onerror = function() {
      const fullSrc = `photos/${photo.src}`;
      if (this.src !== fullSrc) { this.src = fullSrc; }
    };
    thumb.appendChild(img);

    const del = document.createElement('button');
    del.className = 'unsorted-thumb-del';
    del.textContent = '×';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteUnsortedPhoto(i);
    });
    thumb.appendChild(del);

    thumb.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startTrayDrag(i, e.clientX, e.clientY);
    });

    thumb.addEventListener('click', (e) => {
      if (thumb._dragged) return;
      if (!currentAlbum) return;
      moveFromUnsortedToAlbum(i, currentAlbum);
    });

    thumb.addEventListener('mouseenter', () => showTrayHover(photo, thumb));
    thumb.addEventListener('mouseleave', hideTrayHover);

    strip.appendChild(thumb);
  });
}

function deleteUnsortedPhoto(index) {
  const photo = albums._unsorted[index];

  // Queue for deletion on save (same as deletePhoto)
  pendingDeletes.push({
    full: `photos/${photo.src}`,
    grid: `photos/${photo.grid}`
  });

  albums._unsorted.splice(index, 1);
  renderUnsortedTray();
}

function startTrayDrag(unsortedIndex, initX, initY) {
  const photo = albums._unsorted[unsortedIndex];
  const imgSrc = unsortedPreviews.get(photo.grid) || `photos/${photo.grid}`;
  const thumb = document.querySelectorAll('.unsorted-thumb')[unsortedIndex];

  let mx = initX;
  let my = initY;
  let clone = null;
  let hasDragged = false;
  const startX = initX;
  const startY = initY;

  function onMove(ev) {
    mx = ev.clientX;
    my = ev.clientY;
    const dist = Math.sqrt(Math.pow(mx - startX, 2) + Math.pow(my - startY, 2));
    if (!hasDragged && dist < 6) return;

    if (!hasDragged) {
      hasDragged = true;
      if (thumb) thumb._dragged = true;
      hideTrayHover();
      clone = document.createElement('div');
      clone.style.cssText = `
        position: fixed; left: 0; top: 0;
        width: 90px; height: 64px;
        z-index: 10002; pointer-events: none;
        opacity: 0.85;
        box-shadow: 0 8px 30px rgba(0,0,0,0.5);
        border-radius: 3px; overflow: hidden;
        will-change: transform;
        background-image: url('${imgSrc}');
        background-size: cover; background-position: center;
      `;
      document.body.appendChild(clone);
    }

    // Grow clone as it moves away from tray, shrink near sidebar
    const trayEl = document.getElementById('unsortedTray');
    let scale = 1;
    if (trayEl) {
      const trayRect = trayEl.getBoundingClientRect();
      const distFromTray = Math.max(0, trayRect.top - my);
      const growT = Math.min(1, distFromTray / 200);
      scale = 1 + growT * 1.2;
    }
    const sidebarEdge = 280;
    if (mx < sidebarEdge + 100) {
      const t = Math.max(0, Math.min(1, 1 - (mx - sidebarEdge + 50) / 150));
      scale = scale * (1 - t * 0.65);
    }
    clone.style.transform = `translate(${mx - 45}px, ${my - 32}px) scale(${scale})`;

    document.querySelectorAll('#albumNav a').forEach(link => {
      const rect = link.getBoundingClientRect();
      const over = mx >= rect.left - 10 && mx <= rect.right + 10 &&
                   my >= rect.top - 5 && my <= rect.bottom + 5;
      link.classList.toggle('edit-album-photo-target', over);
    });
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (clone) { clone.remove(); }
    document.querySelectorAll('#albumNav a').forEach(l => l.classList.remove('edit-album-photo-target'));
    if (!hasDragged) return;
    // Clear dragged flag after click event fires
    setTimeout(() => { if (thumb) thumb._dragged = false; }, 0);

    let droppedAlbum = null;
    document.querySelectorAll('#albumNav a').forEach(link => {
      const rect = link.getBoundingClientRect();
      const over = mx >= rect.left - 10 && mx <= rect.right + 10 &&
                   my >= rect.top - 5 && my <= rect.bottom + 5;
      if (over) droppedAlbum = link.dataset.album;
    });

    if (!droppedAlbum) {
      const editBar = document.getElementById('editBar');
      const barTop = editBar ? editBar.getBoundingClientRect().top : window.innerHeight;
      if (my < barTop && currentAlbum) {
        droppedAlbum = currentAlbum;
      }
    }

    if (droppedAlbum && droppedAlbum !== '_unsorted') {
      moveFromUnsortedToAlbum(unsortedIndex, droppedAlbum);
    }
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

let trayHoverEl = null;

function showTrayHover(photo, thumbEl) {
  hideTrayHover();
  const src = unsortedPreviews.get(photo.grid) || `photos/${photo.src}`;
  const thumbRect = thumbEl.getBoundingClientRect();

  const preview = document.createElement('div');
  preview.className = 'tray-hover-preview';
  const img = document.createElement('img');
  img.src = src;
  preview.appendChild(img);
  document.body.appendChild(preview);
  trayHoverEl = preview;

  // Position above the thumbnail, centered
  requestAnimationFrame(() => {
    const pw = preview.offsetWidth;
    let left = thumbRect.left + thumbRect.width / 2 - pw / 2;
    left = Math.max(8, Math.min(window.innerWidth - pw - 8, left));
    preview.style.left = left + 'px';
    preview.style.bottom = (window.innerHeight - thumbRect.top + 12) + 'px';
    preview.style.opacity = '1';
    preview.style.transform = 'translateY(0)';
  });
}

function hideTrayHover() {
  if (trayHoverEl) {
    const el = trayHoverEl;
    trayHoverEl = null;
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 300);
  }
}

function moveFromUnsortedToAlbum(unsortedIndex, targetAlbum) {
  const photo = albums._unsorted[unsortedIndex];
  const filename = photo.src.split('/').pop();
  const srcFolder = photo.src.split('/')[0];

  // Find target folder prefix
  const targetPhotos = albums[targetAlbum];
  let targetFolderPrefix = targetAlbum;
  if (targetPhotos && targetPhotos.length > 0) {
    targetFolderPrefix = targetPhotos[0].src.split('/')[0];
  }

  // Record the move (update existing entry if file was already moved)
  recordMove(filename, srcFolder, targetFolderPrefix);

  albums._unsorted.splice(unsortedIndex, 1);
  if (!albums[targetAlbum]) albums[targetAlbum] = [];
  albums[targetAlbum].push(photo);

  if (targetAlbum === currentAlbum) {
    currentPhotos.push({
      full: `photos/${photo.src}`,
      grid: `photos/${photo.grid}`,
      width: photo.w,
      height: photo.h
    });
    renderEditGrid();
  }

  renderUnsortedTray();
}

// ============================================
// Photo Delete
// ============================================
function deletePhoto(photoIndex) {
  const photo = currentPhotos[photoIndex];

  // Queue for deletion on save
  pendingDeletes.push({
    full: `photos/${photo.full.replace('photos/', '')}`,
    grid: `photos/${photo.grid.replace('photos/', '')}`
  });

  // Remove any pending move for this file (no point moving a deleted file)
  const filename = photo.full.split('/').pop();
  pendingMoves = pendingMoves.filter(m => m.file !== filename);

  // Remove from local state
  currentPhotos.splice(photoIndex, 1);
  syncCurrentAlbum();

  carouselBuiltForAlbum = null;
  renderEditGrid();
}

async function deleteFileFromGitHub(path, token) {
  // Get SHA first
  const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (res.status === 404) return; // Already gone
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

  const data = await res.json();

  const delRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: `Delete ${path}`,
      sha: data.sha
    })
  });

  if (delRes.status === 404) return; // Already gone
  if (!delRes.ok) {
    const err = await delRes.json();
    throw new Error(`GitHub delete failed (${delRes.status}): ${err.message}`);
  }
}

// ============================================
// Photo Upload System
// ============================================
const GRID_MAX_WIDTH = 1000;
const WEBP_QUALITY = 0.82;

const ALLOWED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'];
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_DIMENSION = 20000;

async function handlePhotoUpload(e) {
  const allFiles = Array.from(e.target.files);
  if (!allFiles.length) return;

  const token = localStorage.getItem('gh_token');
  if (!token) {
    alert('No token found. Please log in again.');
    return;
  }

  // Validate files
  const rejected = [];
  const validFiles = [];
  for (const file of allFiles) {
    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
      rejected.push(`${file.name}: unsupported type (${file.type || 'unknown'})`);
      continue;
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      rejected.push(`${file.name}: exceeds 50MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      continue;
    }
    validFiles.push(file);
  }

  if (rejected.length > 0) {
    alert('Rejected files:\n' + rejected.join('\n'));
  }

  const files = validFiles;
  if (!files.length) return;

  // Show progress and block Save during upload
  isUploading = true;
  const saveBtn = document.querySelector('.edit-save');
  if (saveBtn) saveBtn.disabled = true;
  const bar = document.getElementById('editBar');
  const label = bar.querySelector('.edit-bar-label');
  const originalLabel = label.textContent;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    label.textContent = `UPLOADING ${i + 1}/${files.length}...`;

    try {
      await uploadSinglePhoto(file, token);
    } catch (err) {
      console.error('Upload failed for', file.name, err);
      alert(`Failed to upload ${file.name}: ${err.message}`);
    }
  }

  isUploading = false;
  if (saveBtn) saveBtn.disabled = false;
  label.textContent = originalLabel;
  e.target.value = ''; // Reset file input
}

async function uploadSinglePhoto(file, token) {
  // Load image
  const img = await loadImage(file);
  const origW = img.naturalWidth;
  const origH = img.naturalHeight;

  if (origW <= 0 || origH <= 0 || origW > MAX_DIMENSION || origH > MAX_DIMENSION) {
    throw new Error(`invalid dimensions (${origW}x${origH})`);
  }

  // Determine the next filename number by scanning ALL albums for unsorted/ paths
  // (photos moved to albums keep their unsorted/ paths until server-side move runs)
  const existingNums = [];
  for (const photos of Object.values(albums)) {
    for (const p of photos) {
      if (p.src.startsWith('unsorted/')) {
        const num = parseInt(p.src.split('/').pop().replace('.webp', '')) || 0;
        existingNums.push(num);
      }
    }
  }
  // Also include pending deletes (files still on server until save)
  for (const d of pendingDeletes) {
    const src = d.full.replace('photos/', '');
    if (src.startsWith('unsorted/')) {
      const num = parseInt(src.split('/').pop().replace('.webp', '')) || 0;
      existingNums.push(num);
    }
  }
  const nextNum = (existingNums.length > 0 ? Math.max(...existingNums) : 0) + 1;
  const paddedNum = String(nextNum).padStart(3, '0');

  const folderPrefix = 'unsorted';

  // Generate full-res WebP
  const fullWebP = await imageToWebP(img, origW, origH);

  // Generate grid thumbnail WebP
  let gridW = origW;
  let gridH = origH;
  if (origW > GRID_MAX_WIDTH) {
    gridW = GRID_MAX_WIDTH;
    gridH = Math.round(origH * (GRID_MAX_WIDTH / origW));
  }
  const gridWebP = await imageToWebP(img, gridW, gridH);

  // Upload full-res to GitHub
  const fullPath = `photos/${folderPrefix}/${paddedNum}.webp`;
  await uploadFileToGitHub(fullPath, fullWebP, token);

  // Upload grid to GitHub
  const gridPath = `photos/${folderPrefix}/grid/${paddedNum}.webp`;
  await uploadFileToGitHub(gridPath, gridWebP, token);

  // Add to local unsorted tray
  const newPhotoData = {
    src: `${folderPrefix}/${paddedNum}.webp`,
    grid: `${folderPrefix}/grid/${paddedNum}.webp`,
    w: origW,
    h: origH
  };
  albums._unsorted.push(newPhotoData);

  // Cache preview so thumbnail shows instantly (before GitHub Pages deploys)
  unsortedPreviews.set(newPhotoData.grid, `data:image/webp;base64,${gridWebP}`);

  // Save updated photos.json (persist _unsorted entry so files aren't orphaned)
  // NOTE: intentionally not calling syncCurrentAlbum() here — reorder state
  // should only be committed when the user clicks Save
  await saveFileToGitHub('photos.json', JSON.stringify(albums, null, 2), token);

  // Re-render tray
  renderUnsortedTray();
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

function imageToWebP(img, targetW, targetH) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');

    // Draw image (this strips EXIF)
    ctx.drawImage(img, 0, 0, targetW, targetH);

    canvas.toBlob((blob) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Return base64 without the data:... prefix
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    }, 'image/webp', WEBP_QUALITY);
  });
}

async function uploadFileToGitHub(path, base64Content, token) {
  // Check if file already exists (need SHA for update)
  let sha = null;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (res.ok) {
      const data = await res.json();
      sha = data.sha;
    }
  } catch(e) {}

  const body = {
    message: `Upload ${path}`,
    content: base64Content
  };
  if (sha) body.sha = sha;

  const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`GitHub upload failed (${res.status}): ${err.message}`);
  }
}

async function saveOrder() {
  if (isUploading) return; // Don't save while uploads are in progress
  const token = localStorage.getItem('gh_token');
  if (!token) {
    alert('No token found. Please log in again.');
    exitEditMode();
    return;
  }

  const saveBtn = document.querySelector('.edit-save');
  saveBtn.textContent = 'SAVING...';
  saveBtn.disabled = true;

  try {
    // Sync current album's photos back into albums
    syncCurrentAlbum();

    // Strip deleted photos from albums BEFORE saving anything
    if (pendingDeletes.length > 0) {
      const deletePaths = new Set(pendingDeletes.map(d => d.full.replace('photos/', '')));
      for (const [albumName, photos] of Object.entries(albums)) {
        albums[albumName] = photos.filter(p => !deletePaths.has(p.src));
      }
    }

    // Build order.json fresh (don't merge with stale remote data)
    const orderData = {};
    for (const [albumName, photos] of Object.entries(albums)) {
      orderData[albumName] = photos.map(p => {
        const parts = p.src.split('/');
        return parts[parts.length - 1].replace('.webp', '');
      });
    }

    // Save photos.json, order.json, and moves.json
    await saveFileToGitHub('photos.json', JSON.stringify(albums, null, 2), token);
    await saveFileToGitHub('order.json', JSON.stringify(orderData, null, 2), token);

    if (pendingMoves.length > 0) {
      await saveFileToGitHub('moves.json', JSON.stringify(pendingMoves, null, 2), token);
      pendingMoves = [];
    }

    // Delete files from GitHub
    for (const del of pendingDeletes) {
      await deleteFileFromGitHub(del.full, token);
      await deleteFileFromGitHub(del.grid, token);
    }
    pendingDeletes = [];

    carouselBuiltForAlbum = null;

    saveBtn.textContent = 'SAVED ✓';
    setTimeout(() => exitEditMode(true), 800);

  } catch(err) {
    console.error('Save failed:', err);
    alert('Save failed: ' + err.message + '\nCheck console for details.');
    if (err.message && err.message.includes('401')) {
      localStorage.removeItem('gh_token');
    }
    saveBtn.textContent = 'SAVE';
    saveBtn.disabled = false;
  }
}

async function fetchFileFromGitHub(path, token) {
  const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

  const data = await res.json();
  return {
    content: atob(data.content.replace(/\n/g, '')),
    sha: data.sha
  };
}

async function saveFileToGitHub(path, content, token) {
  // Get current file SHA (needed for updates)
  let sha = null;
  try {
    const existing = await fetchFileFromGitHub(path, token);
    if (existing) sha = existing.sha;
  } catch(e) {}

  const body = {
    message: `Update ${path} - reorder ${new Date().toISOString()}`,
    content: btoa(unescape(encodeURIComponent(content)))
  };

  if (sha) body.sha = sha;

  const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errData = await res.json();
    throw new Error(`GitHub save failed: ${res.status} - ${errData.message}`);
  }

  return res.json();
}
