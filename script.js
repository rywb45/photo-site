// Set the current year dynamically
document.getElementById('year').textContent = new Date().getFullYear();

// State
let albums = {};
let currentAlbum = null;
let currentPhotos = [];
let currentIndex = 0;

// Performance: Track which album carousel is built for
let carouselBuiltForAlbum = null;

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
      link.addEventListener('click', (e) => {
        e.preventDefault();
        switchAlbum(albumName);
      });
      nav.appendChild(link);
    });

    if (albumNames.length > 0 && window.innerWidth > 768) {
      switchAlbum(albumNames[0]);
    }
  } catch (error) {
    console.error('Failed to load albums:', error);
  }
}

function switchAlbum(albumName, clickedElement = null) {
  // If in edit mode, save current album's reorder before switching
  if (editMode && currentAlbum && currentPhotos.length) {
    albums[currentAlbum] = currentPhotos.map(p => ({
      src: p.full.replace('photos/', ''),
      grid: p.grid.replace('photos/', ''),
      w: p.width,
      h: p.height
    }));
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
        img.src = item.grid;
        img.alt = '';
        img.loading = 'lazy';
        img.width = Math.round(itemWidth);
        img.height = Math.round(adjustedHeight);
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
  currentPhotos.forEach((photo) => {
    const slide = document.createElement('div');
    slide.className = 'lb-slide';
    const img = document.createElement('img');
    img.src = photo.full;
    img.alt = '';
    slide.appendChild(img);
    lbTrack.appendChild(slide);
  });

  buildDots();
  carouselBuiltForAlbum = currentAlbum;
}

function buildDots() {
  const dotsContainer = document.getElementById('lbDots');
  dotsContainer.innerHTML = '';
  currentPhotos.forEach((_, index) => {
    const dot = document.createElement('div');
    dot.className = 'lb-dot';
    dot.dataset.index = index;
    dotsContainer.appendChild(dot);
  });
}

function updateDots() {
  const dots = document.querySelectorAll('.lb-dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === currentIndex);
  });
}

function goToSlide(index, animate = true) {
  resetZoom();
  // If navigating away from original photo, clear morph source
  if (index !== currentIndex) {
    if (morphSource) morphSource.style.opacity = '';
    morphSource = null;
    morphRect = null;
  }
  currentIndex = index;
  const offset = -currentIndex * window.innerWidth;
  if (animate) {
    lbTrack.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
  } else {
    lbTrack.style.transition = 'none';
  }
  lbTrack.style.transform = `translateX(${offset}px)`;
  updateDots();

  if (window.innerWidth > 768) {
    lbPrev.style.display = currentIndex === 0 ? 'none' : 'block';
    lbNext.style.display = currentIndex === currentPhotos.length - 1 ? 'none' : 'block';
  }
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
    lbTrack.style.transform = `translateX(${-currentIndex * window.innerWidth}px) translateY(0)`;

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

    // After animation, reveal real lightbox and remove clone
    setTimeout(() => {
      lbTrack.style.opacity = '1';
      lightbox.style.transition = '';

      if (morphClone && morphClone.parentNode) {
        morphClone.remove();
        morphClone = null;
      }

      if (window.innerWidth > 768) {
        lbPrev.style.display = currentIndex === 0 ? 'none' : 'block';
        lbNext.style.display = currentIndex === currentPhotos.length - 1 ? 'none' : 'block';
      }
    }, 320);

  } else {
    // No source — instant open (e.g. keyboard or programmatic)
    goToSlide(index, false);
    lightbox.classList.add('active');
    lightbox.style.opacity = '1';
    lbTrack.style.transform = `translateX(${-currentIndex * window.innerWidth}px) translateY(0)`;
    document.body.style.overflow = 'hidden';

    if (window.innerWidth > 768) {
      lbPrev.style.display = currentIndex === 0 ? 'none' : 'block';
      lbNext.style.display = currentIndex === currentPhotos.length - 1 ? 'none' : 'block';
    }
  }
}

function closeLightbox() {
  resetZoom();

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

// Click anywhere on lightbox backdrop to close (not on image or buttons)
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox || e.target.classList.contains('lb-slide')) {
    closeLightbox();
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
      const currentOffset = -currentIndex * window.innerWidth;
      lbTrack.style.transition = 'none';
      lbTrack.style.transform = `translateX(${currentOffset}px) translateY(${absDelta}px)`;
      lightbox.style.background = `rgba(255, 255, 255, ${0.7 * opacity})`;
    }

    if (wheelTimeout) clearTimeout(wheelTimeout);

    wheelTimeout = setTimeout(() => {
      const shouldDismiss = wheelDeltaY < -150;

      if (shouldDismiss) {
        // Clear morph source
        if (morphSource) morphSource.style.opacity = '';
        morphSource = null;
        morphRect = null;

        lbTrack.style.transition = 'transform 0.2s ease-out';
        lightbox.style.transition = 'background 0.2s ease-out';
        lbTrack.style.transform = `translateX(${-currentIndex * window.innerWidth}px) translateY(${window.innerHeight}px)`;
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
          lbTrack.style.transform = `translateX(${-currentIndex * window.innerWidth}px) translateY(0)`;
        }, 210);
      } else {
        lbTrack.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        lightbox.style.transition = 'background 0.3s ease';
        const currentOffset = -currentIndex * window.innerWidth;
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

    const baseOffset = -currentIndex * window.innerWidth;
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

function getDistance(t1, t2) {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getCurrentSlideImg() {
  const slides = lbTrack.querySelectorAll('.lb-slide');
  if (slides[currentIndex]) {
    return slides[currentIndex].querySelector('img');
  }
  return null;
}

function applyZoom(img) {
  if (zoomScale <= 1) {
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
    return;
  }

  // Skip if pinch just ended (prevents glitch from leftover finger)
  if (pinchJustEnded) return;

  // Double-tap to zoom
  const now = Date.now();
  const timeSinceLastTap = now - lastTapTime;
  lastTapTime = now;

  if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
    e.preventDefault();
    const img = getCurrentSlideImg();
    if (!img) return;

    if (zoomScale > 1) {
      resetZoom();
    } else {
      zoomScale = 2.5;
      panOffsetX = 0;
      panOffsetY = 0;
      img.style.transition = 'transform 0.3s ease';
      applyZoom(img);
      setTimeout(() => { img.style.transition = ''; }, 300);
    }
    isDragging = false;
    return;
  }

  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchCurrentX = touchStartX;
  touchCurrentY = touchStartY;
  startTime = Date.now();
  baseOffset = -currentIndex * window.innerWidth;
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
  // Pinch zoom
  if (isPinching && e.touches.length === 2) {
    e.preventDefault();
    const dist = getDistance(e.touches[0], e.touches[1]);
    zoomScale = Math.max(1, Math.min(initialPinchScale * (dist / initialPinchDist), 5));

    const img = getCurrentSlideImg();
    if (img) {
      img.style.transition = 'none';
      applyZoom(img);
    }
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
      const currentOffset = -currentIndex * window.innerWidth;
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
      }
    }
    return;
  }

  // Ignore if in cooldown
  if (pinchJustEnded) return;

  // End pan while zoomed
  if (zoomScale > 1) {
    return;
  }

  if (!isDragging) return;
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
      lbTrack.style.transform = `translateX(${-currentIndex * window.innerWidth}px) translateY(${window.innerHeight}px)`;
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
let sortableInstance = null;
let nameClickCount = 0;
let nameClickTimer = null;
let preEditPhotos = null;
let preEditAlbums = null;
let preEditAlbumOrder = null;
let pendingMoves = [];

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

  if (!token) {
    token = prompt('GitHub Personal Access Token:');
    if (!token) return;
    localStorage.setItem('gh_token', token);
  }

  enterEditMode();
}

function enterEditMode() {
  editMode = true;
  document.body.classList.add('edit-mode');

  // Snapshot current state for cancel
  preEditPhotos = [...currentPhotos];
  preEditAlbums = JSON.parse(JSON.stringify(albums));
  preEditAlbumOrder = Object.keys(albums);

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

  const nav = document.getElementById('albumNav');
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
  let targetFolderPrefix = targetAlbum;
  if (targetPhotos.length > 0) {
    targetFolderPrefix = targetPhotos[0].src.split('/')[0];
  }

  // Record the move for the upload script
  pendingMoves.push({
    file: filename,
    from: srcFolder,
    to: targetFolderPrefix
  });

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

  // Sync current album back
  albums[currentAlbum] = currentPhotos.map(p => ({
    src: p.full.replace('photos/', ''),
    grid: p.grid.replace('photos/', ''),
    w: p.width,
    h: p.height
  }));

  // Add to target album (with original paths)
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
    const sep = document.createElement('div');
    sep.className = 'add-album-separator';
    nav.appendChild(sep);

    const addBtn = document.createElement('button');
    addBtn.className = 'add-album-btn';
    addBtn.textContent = '+ NEW ALBUM';
    addBtn.addEventListener('click', () => createAlbum());
    nav.appendChild(addBtn);

    // Animate in after a frame
    requestAnimationFrame(() => {
      sep.classList.add('visible');
      addBtn.classList.add('visible');
    });
  }
}

// ============================================
// Album Management: Create, Rename, Delete
// ============================================
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

    const key = name.toLowerCase().replace(/\s+/g, '-');
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

    const newKey = newName.toLowerCase().replace(/\s+/g, '-');
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
  document.body.classList.remove('edit-mode');

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

  if (sortableInstance) {
    sortableInstance.destroy();
    sortableInstance = null;
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

  // Animate out the add-album elements FIRST (before any rebuild)
  const addSep = document.querySelector('.add-album-separator');
  const addBtn = document.querySelector('.add-album-btn');
  if (addSep) addSep.classList.remove('visible');
  if (addBtn) addBtn.classList.remove('visible');

  // Also fade out album action kebabs
  document.querySelectorAll('.album-actions').forEach(a => {
    a.style.transition = 'opacity 0.3s ease';
    a.style.opacity = '0';
  });

  // Store what we need for the delayed rebuild
  const wasCancelled = !saved && preEditAlbums;
  const savedPreEditAlbums = preEditAlbums;

  // Delay rebuild to let animation finish
  setTimeout(() => {
    // If cancelled, restore original order (but keep any uploads since they're already on GitHub)
    if (wasCancelled) {
      const uploadedPhotos = {};
      for (const [albumName, photos] of Object.entries(albums)) {
        const prePhotos = savedPreEditAlbums[albumName] || [];
        const preSrcs = new Set(prePhotos.map(p => p.src));
        const newPhotos = photos.filter(p => !preSrcs.has(p.src));
        if (newPhotos.length > 0) {
          uploadedPhotos[albumName] = newPhotos;
        }
      }

      albums = savedPreEditAlbums;

      for (const [albumName, photos] of Object.entries(uploadedPhotos)) {
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
  }, 350);

  preEditPhotos = null;
  preEditAlbums = null;
  preEditAlbumOrder = null;
  pendingMoves = [];

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

  function animationLoop() {
    if (!isDragging) return;

    const radius = 300;
    const strength = 50;

    items.forEach((item, i) => {
      if (i === dragSrcIndex) return;

      const r = itemRects[i];
      if (!r) return;

      const dx = r.cx - mouseX;
      const dy = r.cy - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius && dist > 0) {
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
          // Restore animation after spring-back
          setTimeout(() => {
            item.style.transition = '';
            item.style.animation = '';
          }, 400);
        }
      }
    });

    // Move clone with cursor
    if (clone) {
      const cx = mouseX - clone._offsetX;
      const cy = mouseY - clone._offsetY;

      // Shrink clone when near sidebar (left 280px)
      const sidebarEdge = 280;
      let scale = 1;
      if (mouseX < sidebarEdge + 100) {
        const t = Math.max(0, Math.min(1, 1 - (mouseX - sidebarEdge + 50) / 150));
        scale = 1 - t * 0.65; // shrink to ~35% size
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
    let closestDist = Infinity;

    items.forEach((item, i) => {
      if (i === dragSrcIndex) return;
      const r = itemRects[i];
      
      // Check if cursor is within or near the item's bounds
      const withinX = mouseX >= r.cx - r.w / 2 - 40 && mouseX <= r.cx + r.w / 2 + 40;
      const withinY = mouseY >= r.cy - r.h / 2 - 40 && mouseY <= r.cy + r.h / 2 + 40;
      
      const dx = r.cx - mouseX;
      const dy = r.cy - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if ((withinX && withinY) || dist < 350) {
        if (dist < closestDist) {
          closestDist = dist;
          closest = i;
        }
      }
    });

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

    // Add delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'edit-delete-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      deletePhoto(i);
    });
    item.appendChild(deleteBtn);

    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const downX = e.clientX;
      const downY = e.clientY;
      const downIndex = i;
      let activated = false;

      function onFirstMove(ev) {
        const dist = Math.sqrt(Math.pow(ev.clientX - downX, 2) + Math.pow(ev.clientY - downY, 2));
        if (dist < 8) return;

        // Passed threshold — start real drag
        activated = true;
        document.removeEventListener('mousemove', onFirstMove);

        dragSrcIndex = downIndex;
        startX = downX;
        startY = downY;
        mouseX = ev.clientX;
        mouseY = ev.clientY;

        const rect = item.getBoundingClientRect();
        const imgEl = item.querySelector('img');
        const imgSrc = imgEl ? imgEl.src : '';

        clone = document.createElement('div');
        clone._startLeft = rect.left;
        clone._startTop = rect.top;
        clone._offsetX = downX - rect.left;
        clone._offsetY = downY - rect.top;
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

      function onFirstUp() {
        document.removeEventListener('mousemove', onFirstMove);
        document.removeEventListener('mouseup', onFirstUp);
        // If we never activated, it was just a click — do nothing
      }

      document.addEventListener('mousemove', onFirstMove);
      document.addEventListener('mouseup', onFirstUp);
    });
  });

  function onMouseMove(e) {
    if (!isDragging) return;
    mouseX = e.clientX;
    mouseY = e.clientY;

    // Check if hovering over a sidebar album link
    const navLinks = document.querySelectorAll('#albumNav a');
    navLinks.forEach(link => {
      const rect = link.getBoundingClientRect();
      const over = mouseX >= rect.left - 10 && mouseX <= rect.right + 10 &&
                   mouseY >= rect.top - 5 && mouseY <= rect.bottom + 5;
      if (over && link.dataset.album !== currentAlbum) {
        link.classList.add('edit-album-photo-target');
      } else {
        link.classList.remove('edit-album-photo-target');
      }
    });

    // Check if hovering over unsorted button
    const unsortedBtn = document.getElementById('unsortedBtn');
    if (unsortedBtn) {
      const rect = unsortedBtn.getBoundingClientRect();
      const over = mouseX >= rect.left - 10 && mouseX <= rect.right + 10 &&
                   mouseY >= rect.top - 5 && mouseY <= rect.bottom + 5;
      unsortedBtn.classList.toggle('drag-target', over);
    }
  }

  function onMouseUp(e) {
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

    // Check if dropped on unsorted button
    if (unsortedBtn && dragSrcIndex !== null) {
      const rect = unsortedBtn.getBoundingClientRect();
      const over = mouseX >= rect.left - 10 && mouseX <= rect.right + 10 &&
                   mouseY >= rect.top - 5 && mouseY <= rect.bottom + 5;
      if (over) {
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

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  grid._editCleanup = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    grid.removeEventListener('dragover', handleDragOver);
    grid.removeEventListener('dragleave', handleDragLeave);
    grid.removeEventListener('drop', handleDrop);
    cancelAnimationFrame(rafId);
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
      </button>
    </div>
    <div class="edit-bar-actions">
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
    <div class="unsorted-empty" id="unsortedEmpty" style="display:none">
      No unsorted photos. Deleted albums move their photos here.
    </div>
  `;
  document.body.appendChild(tray);
  renderUnsortedTray();

  bar.offsetHeight;
  bar.classList.add('visible');

  // Delay tray visibility so it doesn't flash during edit bar entrance
  setTimeout(() => {
    tray.classList.add('ready');
  }, 400);

  document.getElementById('editUploadInput').addEventListener('change', handlePhotoUpload);
}

function toggleUnsortedTray() {
  const tray = document.getElementById('unsortedTray');
  const btn = document.getElementById('unsortedBtn');
  if (!tray) return;
  tray.classList.toggle('open');
  btn.classList.toggle('active');
}

function renderUnsortedTray() {
  const strip = document.getElementById('unsortedStrip');
  const empty = document.getElementById('unsortedEmpty');
  if (!strip) return;

  const unsorted = albums._unsorted || [];
  strip.innerHTML = '';

  if (unsorted.length === 0) {
    strip.style.display = 'none';
    if (empty) empty.style.display = '';
    return;
  }

  strip.style.display = '';
  if (empty) empty.style.display = 'none';

  unsorted.forEach((photo, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'unsorted-thumb';

    const img = document.createElement('img');
    img.src = `photos/${photo.grid}`;
    img.draggable = false;
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
      startTrayDrag(i, e);
    });

    strip.appendChild(thumb);
  });
}

async function deleteUnsortedPhoto(index) {
  const token = localStorage.getItem('gh_token');
  if (!token) { alert('No token found.'); return; }

  const photo = albums._unsorted[index];
  const bar = document.getElementById('editBar');
  const label = bar.querySelector('.edit-bar-label');
  label.textContent = 'DELETING...';

  try {
    await deleteFileFromGitHub(`photos/${photo.src}`, token);
    await deleteFileFromGitHub(`photos/${photo.grid}`, token);
    albums._unsorted.splice(index, 1);
    await saveFileToGitHub('photos.json', JSON.stringify(albums, null, 2), token);
    renderUnsortedTray();
    label.textContent = 'EDIT MODE';
  } catch (err) {
    console.error('Delete unsorted failed:', err);
    alert('Delete failed: ' + err.message);
    label.textContent = 'EDIT MODE';
  }
}

function startTrayDrag(unsortedIndex, e) {
  const photo = albums._unsorted[unsortedIndex];
  const imgSrc = `photos/${photo.grid}`;

  let mouseX = e.clientX;
  let mouseY = e.clientY;
  let clone = null;
  let hasDragged = false;
  const startX = e.clientX;
  const startY = e.clientY;

  function onMove(ev) {
    mouseX = ev.clientX;
    mouseY = ev.clientY;
    const dist = Math.sqrt(Math.pow(mouseX - startX, 2) + Math.pow(mouseY - startY, 2));
    if (!hasDragged && dist < 6) return;

    if (!hasDragged) {
      hasDragged = true;
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

    clone.style.transform = `translate(${mouseX - 45}px, ${mouseY - 32}px)`;

    document.querySelectorAll('#albumNav a').forEach(link => {
      const rect = link.getBoundingClientRect();
      const over = mouseX >= rect.left - 10 && mouseX <= rect.right + 10 &&
                   mouseY >= rect.top - 5 && mouseY <= rect.bottom + 5;
      link.classList.toggle('edit-album-photo-target', over);
    });
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (clone) { clone.remove(); }
    document.querySelectorAll('#albumNav a').forEach(l => l.classList.remove('edit-album-photo-target'));
    if (!hasDragged) return;

    let droppedAlbum = null;
    document.querySelectorAll('#albumNav a').forEach(link => {
      const rect = link.getBoundingClientRect();
      const over = mouseX >= rect.left - 10 && mouseX <= rect.right + 10 &&
                   mouseY >= rect.top - 5 && mouseY <= rect.bottom + 5;
      if (over) droppedAlbum = link.dataset.album;
    });

    if (!droppedAlbum) {
      const grid = document.getElementById('grid');
      if (grid) {
        const rect = grid.getBoundingClientRect();
        if (mouseX >= rect.left && mouseX <= rect.right && mouseY >= rect.top && mouseY <= rect.bottom) {
          droppedAlbum = currentAlbum;
        }
      }
    }

    if (droppedAlbum && droppedAlbum !== '_unsorted') {
      moveFromUnsortedToAlbum(unsortedIndex, droppedAlbum);
    }
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function moveFromUnsortedToAlbum(unsortedIndex, targetAlbum) {
  const photo = albums._unsorted[unsortedIndex];
  albums._unsorted.splice(unsortedIndex, 1);
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
async function deletePhoto(photoIndex) {
  const photo = currentPhotos[photoIndex];
  const filename = photo.full.replace('photos/', '').split('/').pop();

  if (!confirm(`Delete this photo? This cannot be undone.`)) return;

  const token = localStorage.getItem('gh_token');
  if (!token) {
    alert('No token found. Please log in again.');
    return;
  }

  const bar = document.getElementById('editBar');
  const label = bar.querySelector('.edit-bar-label');
  label.textContent = 'DELETING...';

  try {
    const fullPath = `photos/${photo.full.replace('photos/', '')}`;
    const gridPath = `photos/${photo.grid.replace('photos/', '')}`;

    // Delete full-res from GitHub
    await deleteFileFromGitHub(fullPath, token);
    // Delete grid thumbnail from GitHub
    await deleteFileFromGitHub(gridPath, token);

    // Remove from current album
    currentPhotos.splice(photoIndex, 1);

    // Sync back to albums
    albums[currentAlbum] = currentPhotos.map(p => ({
      src: p.full.replace('photos/', ''),
      grid: p.grid.replace('photos/', ''),
      w: p.width,
      h: p.height
    }));

    // Save updated photos.json
    await saveFileToGitHub('photos.json', JSON.stringify(albums, null, 2), token);

    // Re-render
    carouselBuiltForAlbum = null;
    renderEditGrid();

    label.textContent = 'EDIT MODE';
  } catch (err) {
    console.error('Delete failed:', err);
    alert('Delete failed: ' + err.message);
    label.textContent = 'EDIT MODE';
  }
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

async function handlePhotoUpload(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  const token = localStorage.getItem('gh_token');
  if (!token) {
    alert('No token found. Please log in again.');
    return;
  }

  if (!currentAlbum) {
    alert('Please select an album first.');
    return;
  }

  // Show progress
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

  label.textContent = originalLabel;
  e.target.value = ''; // Reset file input
}

async function uploadSinglePhoto(file, token) {
  // Load image
  const img = await loadImage(file);
  const origW = img.naturalWidth;
  const origH = img.naturalHeight;

  // Determine the next filename number
  const albumPhotos = albums[currentAlbum] || [];
  const existingNums = albumPhotos.map(p => {
    const name = p.src.split('/').pop().replace('.webp', '');
    return parseInt(name) || 0;
  });
  const nextNum = (existingNums.length > 0 ? Math.max(...existingNums) : 0) + 1;
  const paddedNum = String(nextNum).padStart(3, '0');

  // Get album folder prefix from existing photos
  let folderPrefix;
  if (albumPhotos.length > 0) {
    folderPrefix = albumPhotos[0].src.split('/')[0];
  } else {
    folderPrefix = currentAlbum;
  }

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

  // Add to albums data
  const newPhotoData = {
    src: `${folderPrefix}/${paddedNum}.webp`,
    grid: `${folderPrefix}/grid/${paddedNum}.webp`,
    w: origW,
    h: origH
  };
  albums[currentAlbum].push(newPhotoData);

  // Update currentPhotos
  currentPhotos.push({
    full: `photos/${newPhotoData.src}`,
    grid: `photos/${newPhotoData.grid}`,
    width: origW,
    height: origH
  });

  // Save updated photos.json
  await saveFileToGitHub('photos.json', JSON.stringify(albums, null, 2), token);

  // Re-render
  carouselBuiltForAlbum = null;
  renderEditGrid();
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
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
    // Save current album's photos back
    if (currentAlbum && albums[currentAlbum] !== undefined) {
      albums[currentAlbum] = currentPhotos.map(p => ({
        src: p.full.replace('photos/', ''),
        grid: p.grid.replace('photos/', ''),
        w: p.width,
        h: p.height
      }));
    }

    // Build order.json
    let orderData = {};
    try {
      const existingOrder = await fetchFileFromGitHub('order.json', token);
      if (existingOrder) {
        orderData = JSON.parse(existingOrder.content);
      }
    } catch(e) {}

    for (const [albumName, photos] of Object.entries(albums)) {
      orderData[albumName] = photos.map(p => {
        const parts = p.src.split('/');
        return parts[parts.length - 1].replace('.webp', '');
      });
    }

    // Detect cross-album moves by comparing to pre-edit state
    // Save photos.json, order.json, and moves.json if needed
    await saveFileToGitHub('photos.json', JSON.stringify(albums, null, 2), token);
    await saveFileToGitHub('order.json', JSON.stringify(orderData, null, 2), token);

    if (pendingMoves.length > 0) {
      await saveFileToGitHub('moves.json', JSON.stringify(pendingMoves, null, 2), token);
      pendingMoves = [];
    }

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
