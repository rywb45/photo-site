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

    const nav = document.getElementById('albumNav');
    const albumNames = Object.keys(albums);

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
  currentPhotos = albums[albumName].map(p => ({
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
  let dragSrcAlbum = null;
  let sidebarDragging = false;

  navLinks.forEach((link) => {
    const albumName = link.dataset.album;

    // Make album links draggable for reordering
    link.setAttribute('draggable', 'true');
    link.classList.add('edit-album-link');

    link.addEventListener('dragstart', (e) => {
      dragSrcAlbum = albumName;
      sidebarDragging = true;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', albumName);
      setTimeout(() => link.classList.add('edit-album-dragging'), 0);
    });

    link.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      // Highlight as album reorder target
      if (sidebarDragging && albumName !== dragSrcAlbum) {
        link.classList.add('edit-album-dragover');
      }
      // Highlight as photo drop target
      if (!sidebarDragging && albumName !== currentAlbum) {
        link.classList.add('edit-album-photo-target');
      }
    });

    link.addEventListener('dragleave', () => {
      link.classList.remove('edit-album-dragover', 'edit-album-photo-target');
    });

    link.addEventListener('drop', (e) => {
      e.preventDefault();
      link.classList.remove('edit-album-dragover', 'edit-album-photo-target');

      if (sidebarDragging && dragSrcAlbum && dragSrcAlbum !== albumName) {
        // Reorder albums
        reorderAlbums(dragSrcAlbum, albumName);
      }
    });

    link.addEventListener('dragend', () => {
      link.classList.remove('edit-album-dragging');
      navLinks.forEach(l => l.classList.remove('edit-album-dragover', 'edit-album-photo-target'));
      sidebarDragging = false;
      dragSrcAlbum = null;
    });
  });
}

function reorderAlbums(fromName, toName) {
  const keys = Object.keys(albums);
  const fromIdx = keys.indexOf(fromName);
  const toIdx = keys.indexOf(toName);
  if (fromIdx === -1 || toIdx === -1) return;

  // Reorder keys
  keys.splice(fromIdx, 1);
  keys.splice(toIdx, 0, fromName);

  // Rebuild albums object in new order
  const newAlbums = {};
  keys.forEach(k => { newAlbums[k] = albums[k]; });
  albums = newAlbums;

  // Rebuild nav
  rebuildAlbumNav();
  setupEditSidebar();
}

function movePhotoToAlbum(photoIndex, targetAlbum) {
  if (targetAlbum === currentAlbum) return;

  const photo = currentPhotos[photoIndex];

  // Convert to storage format
  const photoData = {
    src: photo.full.replace('photos/', ''),
    grid: photo.grid.replace('photos/', ''),
    w: photo.width,
    h: photo.height
  };

  // Update source path to target album folder
  const filename = photoData.src.split('/').pop();
  const targetFolder = Object.keys(albums).indexOf(targetAlbum);
  // Find target album's folder prefix from existing photos
  const targetPhotos = albums[targetAlbum];
  let targetPrefix = targetAlbum;
  if (targetPhotos.length > 0) {
    const existingSrc = targetPhotos[0].src;
    targetPrefix = existingSrc.substring(0, existingSrc.lastIndexOf('/'));
  }

  // Update paths
  const srcPrefix = photoData.src.substring(0, photoData.src.lastIndexOf('/'));
  photoData.src = photoData.src.replace(srcPrefix, targetPrefix);
  photoData.grid = photoData.grid.replace(srcPrefix, targetPrefix);

  // Remove from current album
  currentPhotos.splice(photoIndex, 1);
  albums[currentAlbum] = currentPhotos.map(p => ({
    src: p.full.replace('photos/', ''),
    grid: p.grid.replace('photos/', ''),
    w: p.width,
    h: p.height
  }));

  // Add to target album
  albums[targetAlbum].push(photoData);

  // Re-render current grid
  renderEditGrid();
}

function rebuildAlbumNav() {
  const nav = document.getElementById('albumNav');
  nav.innerHTML = '';
  Object.keys(albums).forEach((albumName) => {
    const link = document.createElement('a');
    link.textContent = albumName.toUpperCase();
    link.dataset.album = albumName;
    if (albumName === currentAlbum) link.classList.add('active');
    link.addEventListener('click', (e) => {
      e.preventDefault();
      switchAlbum(albumName);
      if (editMode) setupEditSidebar();
    });
    nav.appendChild(link);
  });
}

function exitEditMode(saved) {
  editMode = false;
  document.body.classList.remove('edit-mode');

  const grid = document.getElementById('grid');
  if (grid._editCleanup) {
    grid._editCleanup();
    grid._editCleanup = null;
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

  // If cancelled, restore original order
  if (!saved && preEditPhotos) {
    currentPhotos = preEditPhotos;
    albums = preEditAlbums;
    rebuildAlbumNav();
  }

  preEditPhotos = null;
  preEditAlbums = null;
  preEditAlbumOrder = null;

  renderGrid();

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
  renderGrid();

  const grid = document.getElementById('grid');
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
      clone.style.left = (mouseX - clone._offsetX) + 'px';
      clone.style.top = (mouseY - clone._offsetY) + 'px';
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

    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragSrcIndex = i;
      startX = e.clientX;
      startY = e.clientY;

      const rect = item.getBoundingClientRect();

      // Create floating clone
      clone = item.cloneNode(true);
      clone.style.cssText = `
        position: fixed;
        left: ${rect.left}px;
        top: ${rect.top}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        z-index: 10000;
        pointer-events: none;
        opacity: 0.85;
        box-shadow: 0 12px 40px rgba(0,0,0,0.4);
        border-radius: 4px;
        overflow: hidden;
        transition: none;
        will-change: left, top;
      `;
      clone._offsetX = e.clientX - rect.left;
      clone._offsetY = e.clientY - rect.top;
      document.body.appendChild(clone);

      item.classList.add('edit-dragging');
      isDragging = true;
      cachePositions();
      rafId = requestAnimationFrame(animationLoop);
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

    // Clear album highlights
    document.querySelectorAll('#albumNav a').forEach(l => l.classList.remove('edit-album-photo-target'));

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
    cancelAnimationFrame(rafId);
  };
}

function showEditBar() {
  const bar = document.createElement('div');
  bar.id = 'editBar';
  bar.className = 'edit-bar';
  bar.innerHTML = `
    <span class="edit-bar-label">EDIT MODE</span>
    <div class="edit-bar-actions">
      <button class="edit-bar-btn edit-cancel" onclick="exitEditMode()">CANCEL</button>
      <button class="edit-bar-btn edit-save" onclick="saveOrder()">SAVE</button>
    </div>
  `;
  document.body.appendChild(bar);
  // Force reflow then animate in
  bar.offsetHeight;
  bar.classList.add('visible');
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
    albums[currentAlbum] = currentPhotos.map(p => ({
      src: p.full.replace('photos/', ''),
      grid: p.grid.replace('photos/', ''),
      w: p.width,
      h: p.height
    }));

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
    let moves = [];
    if (preEditAlbums) {
      for (const [albumName, photos] of Object.entries(albums)) {
        for (const photo of photos) {
          const filename = photo.src.split('/').pop();
          // Check if this file existed in a different album before
          for (const [oldAlbum, oldPhotos] of Object.entries(preEditAlbums)) {
            if (oldAlbum === albumName) continue;
            const wasHere = oldPhotos.some(p => p.src.split('/').pop() === filename);
            if (wasHere) {
              const oldFolder = oldPhotos[0].src.substring(0, oldPhotos[0].src.lastIndexOf('/'));
              const newFolder = photo.src.substring(0, photo.src.lastIndexOf('/'));
              moves.push({ file: filename, from: oldFolder, to: newFolder });
            }
          }
        }
      }
    }

    // Save photos.json, order.json, and moves.json if needed
    await saveFileToGitHub('photos.json', JSON.stringify(albums, null, 2), token);
    await saveFileToGitHub('order.json', JSON.stringify(orderData, null, 2), token);

    if (moves.length > 0) {
      await saveFileToGitHub('moves.json', JSON.stringify(moves, null, 2), token);
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
