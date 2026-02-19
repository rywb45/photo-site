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

  renderGrid();
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

    // Create clone at grid position
    morphClone = document.createElement('div');
    morphClone.className = 'morph-clone';
    morphClone.style.cssText = `
      position: fixed;
      left: ${morphRect.left}px;
      top: ${morphRect.top}px;
      width: ${morphRect.width}px;
      height: ${morphRect.height}px;
      z-index: 1002;
      border-radius: 1px;
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
    `;

    const cloneImg = document.createElement('img');
    cloneImg.src = currentPhotos[index].full;
    cloneImg.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    morphClone.appendChild(cloneImg);
    document.body.appendChild(morphClone);

    // Hide the source in the grid
    morphSource.style.opacity = '0';

    // Show lightbox backdrop only (hide the track)
    lightbox.classList.add('active');
    lightbox.style.opacity = '0';
    lightbox.style.transition = 'opacity 0.25s ease';
    lbTrack.style.opacity = '0';
    document.body.style.overflow = 'hidden';

    // Set up the slide position now while hidden
    goToSlide(index, false);
    lbTrack.style.transform = `translateX(${-currentIndex * window.innerWidth}px) translateY(0)`;

    // Force reflow then animate
    morphClone.offsetHeight;

    // Calculate target position (centered, same as lightbox)
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

    // Animate clone to center
    morphClone.style.left = targetL + 'px';
    morphClone.style.top = targetT + 'px';
    morphClone.style.width = targetW + 'px';
    morphClone.style.height = targetH + 'px';

    // Fade in backdrop
    lightbox.style.opacity = '1';

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
    }, 310);

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
      border-radius: 1px;
      overflow: hidden;
      transition: all 0.25s cubic-bezier(0.2, 0, 0, 1);
    `;

    const cloneImg = document.createElement('img');
    cloneImg.src = currentPhotos[currentIndex].full;
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

    // Force reflow
    morphClone.offsetHeight;

    // Animate back to grid
    morphClone.style.left = freshRect.left + 'px';
    morphClone.style.top = freshRect.top + 'px';
    morphClone.style.width = freshRect.width + 'px';
    morphClone.style.height = freshRect.height + 'px';

    setTimeout(() => {
      if (morphSource) morphSource.style.opacity = '';
      if (morphClone && morphClone.parentNode) {
        morphClone.remove();
        morphClone = null;
      }
      morphSource = null;
      morphRect = null;
    }, 260);

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

    // Only track downward (positive deltaY with natural scrolling)
    if (wheelDeltaY > 0) {
      const progress = Math.min(wheelDeltaY / 300, 1);
      const opacity = 1 - (progress * 0.5);
      const currentOffset = -currentIndex * window.innerWidth;
      lbTrack.style.transition = 'none';
      lbTrack.style.transform = `translateX(${currentOffset}px) translateY(${wheelDeltaY}px)`;
      lightbox.style.background = `rgba(255, 255, 255, ${0.7 * opacity})`;
    }

    if (wheelTimeout) clearTimeout(wheelTimeout);

    wheelTimeout = setTimeout(() => {
      const shouldDismiss = wheelDeltaY > 150;

      if (shouldDismiss) {
        // Clear morph source so closeLightbox does a simple close
        if (morphSource) morphSource.style.opacity = '';
        morphSource = null;
        morphRect = null;

        lbTrack.style.transition = 'transform 0.25s ease-out';
        lightbox.style.transition = 'background 0.25s ease-out';
        lbTrack.style.transform = `translateX(${-currentIndex * window.innerWidth}px) translateY(${window.innerHeight}px)`;
        lightbox.style.background = 'rgba(255, 255, 255, 0)';
        setTimeout(() => {
          closeLightbox();
          lbTrack.style.transition = '';
          lightbox.style.transition = '';
          lbTrack.style.transform = `translateX(${-currentIndex * window.innerWidth}px) translateY(0)`;
        }, 260);
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
  resizeTimeout = setTimeout(renderGrid, 150);
});

// Mobile close button
const mobileClose = document.getElementById('mobileClose');
if (mobileClose) {
  mobileClose.addEventListener('click', closeAlbumView);
}
