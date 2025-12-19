// Set the current year dynamically
document.getElementById('year').textContent = new Date().getFullYear();

// State
let albums = {};
let currentAlbum = null;
let currentPhotos = [];
let currentIndex = 0;

// Performance: Cache image dimensions
const dimensionCache = new Map();

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
// Image dimension loading with caching
// ============================================
async function getImageDimensions(src) {
  if (dimensionCache.has(src)) {
    return dimensionCache.get(src);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      dimensionCache.set(src, dims);
      resolve(dims);
    };
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = src;
  });
}

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

function switchAlbum(albumName) {
  currentAlbum = albumName;
  currentPhotos = albums[albumName].map(f => `photos/${f}`);

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
    document.querySelector('.main').classList.add('active');
    document.getElementById('mobileHeaderTitle').textContent = albumName.toUpperCase();
  }

  renderGrid();
}

// ============================================
// Grid rendering
// ============================================
async function renderGrid() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';

  const photosWithDimensions = await Promise.all(
    currentPhotos.map(async (photo) => {
      const dims = await getImageDimensions(photo);
      return { src: photo, ...dims };
    })
  );

  const targetRowHeight = 320;
  const computedStyle = getComputedStyle(grid);
  const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
  const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
  const containerWidth = (grid.clientWidth || 1200) - paddingLeft - paddingRight;
  const gap = 6;

  let currentRow = [];
  let currentRowWidth = 0;

  photosWithDimensions.forEach((photo, index) => {
    const aspectRatio = photo.width / photo.height;
    const scaledWidth = targetRowHeight * aspectRatio;

    currentRow.push({ ...photo, index });
    currentRowWidth += scaledWidth;

    const isLastPhoto = index === photosWithDimensions.length - 1;
    const rowFull = currentRowWidth + gap * (currentRow.length - 1) >= containerWidth;

    if (rowFull || isLastPhoto) {
      const totalGaps = gap * (currentRow.length - 1);
      const availableWidth = containerWidth - totalGaps;
      const scale = availableWidth / currentRowWidth;
      const adjustedHeight = targetRowHeight * scale;

      const rowDiv = document.createElement('div');
      rowDiv.className = 'grid-row';

      currentRow.forEach((item) => {
        const itemWidth = (item.width / item.height) * adjustedHeight;
        const itemDiv = document.createElement('div');
        itemDiv.className = 'grid-item';
        itemDiv.style.width = `${itemWidth}px`;
        itemDiv.style.height = `${adjustedHeight}px`;

        const img = document.createElement('img');
        img.src = item.src;
        img.alt = '';
        img.loading = 'lazy';
        img.addEventListener('click', () => openLightbox(item.index));

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
// Lightbox carousel
// ============================================
function buildCarousel() {
  if (carouselBuiltForAlbum === currentAlbum) return;

  lbTrack.innerHTML = '';
  currentPhotos.forEach((photo) => {
    const slide = document.createElement('div');
    slide.className = 'lb-slide';
    const img = document.createElement('img');
    img.src = photo;
    img.alt = '';
    slide.appendChild(img);
    lbTrack.appendChild(slide);
  });

  // Build dots once with carousel
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
  currentIndex = index;
  const offset = -currentIndex * window.innerWidth;
  if (animate) {
    lbTrack.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
  } else {
    lbTrack.style.transition = 'none';
  }
  lbTrack.style.transform = `translateX(${offset}px)`;
  updateDots();

  // Show/hide arrows at edges
  if (window.innerWidth > 768) {
    lbPrev.style.display = currentIndex === 0 ? 'none' : 'block';
    lbNext.style.display = currentIndex === currentPhotos.length - 1 ? 'none' : 'block';
  }
}

function openLightbox(index) {
  buildCarousel();
  currentIndex = index;
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

function closeLightbox() {
  // Clear any pending wheel timeouts
  if (wheelTimeout) {
    clearTimeout(wheelTimeout);
    wheelTimeout = null;
  }

  // Reset wheel state
  wheelDeltaX = 0;
  wheelDeltaY = 0;
  isWheeling = false;
  wheelDirection = null;

  lightbox.classList.remove('active');
  lightbox.style.opacity = '1';
  lightbox.style.background = '';
  lbTrack.style.transition = '';
  lightbox.style.transition = '';
  document.body.style.overflow = '';
}

function nextImage() {
  if (currentIndex < currentPhotos.length - 1) {
    goToSlide(currentIndex + 1);
  }
}

function prevImage() {
  if (currentIndex > 0) {
    goToSlide(currentIndex - 1);
  }
}

// Lightbox button events
lbClose.addEventListener('click', closeLightbox);
lbPrev.addEventListener('click', prevImage);
lbNext.addEventListener('click', nextImage);

lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox || e.target.classList.contains('lb-slide')) {
    closeLightbox();
  }
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('active')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') prevImage();
  if (e.key === 'ArrowRight') nextImage();
});

// ============================================
// Trackpad/mousewheel swiping
// ============================================
let wheelDeltaX = 0;
let wheelDeltaY = 0;
let wheelTimeout = null;
let isWheeling = false;
let lastWheelTime = 0;
let wheelVelocity = 0;
let wheelDirection = null;
let wheelSampleX = 0;
let wheelSampleY = 0;
let wheelSampleCount = 0;

lightbox.addEventListener('wheel', (e) => {
  if (!lightbox.classList.contains('active')) return;

  e.preventDefault();

  const now = Date.now();
  const timeDelta = now - lastWheelTime;
  lastWheelTime = now;

  if (!isWheeling) {
    isWheeling = true;
    wheelDirection = null;
    wheelSampleX = 0;
    wheelSampleY = 0;
    wheelSampleCount = 0;
    wheelDeltaX = 0;
    wheelDeltaY = 0;
    lbTrack.style.transition = 'none';
    lightbox.style.transition = 'none';
  }

  // Accumulate samples to determine direction
  if (!wheelDirection) {
    wheelSampleX += Math.abs(e.deltaX);
    wheelSampleY += Math.abs(e.deltaY);
    wheelSampleCount++;

    const totalMovement = wheelSampleX + wheelSampleY;
    if (totalMovement > 10 || wheelSampleCount >= 2) {
      wheelDirection = wheelSampleY > wheelSampleX ? 'vertical' : 'horizontal';
    }
  }

  // Vertical swipe down to close
  if (wheelDirection === 'vertical') {
    if (e.deltaY < 0) {
      wheelDeltaY += Math.abs(e.deltaY);
    } else if (wheelDeltaY > 0) {
      wheelDeltaY = Math.max(0, wheelDeltaY - e.deltaY);
    }

    if (wheelDeltaY > 0) {
      const progress = Math.min(wheelDeltaY / 300, 1);
      const opacity = 1 - (progress * 0.5);
      const currentOffset = -currentIndex * window.innerWidth;
      lbTrack.style.transform = `translateX(${currentOffset}px) translateY(${wheelDeltaY}px)`;
      lightbox.style.background = `rgba(255, 255, 255, ${0.7 * opacity})`;
    }

    if (wheelTimeout) clearTimeout(wheelTimeout);

    wheelTimeout = setTimeout(() => {
      const currentOffset = -currentIndex * window.innerWidth;
      const shouldClose = wheelDeltaY > 50;

      if (shouldClose) {
        closeLightbox();
        lbTrack.style.transform = `translateX(${currentOffset}px) translateY(0)`;
      } else {
        lbTrack.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        lightbox.style.transition = 'background 0.3s ease';
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

lightbox.addEventListener('touchstart', (e) => {
  if (e.target.closest('.lb-btn')) return;

  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchCurrentX = touchStartX;
  touchCurrentY = touchStartY;
  isDragging = true;
  startTime = Date.now();
  baseOffset = -currentIndex * window.innerWidth;
  gestureDirection = null;

  lbTrack.style.transition = 'none';
  lightbox.style.transition = 'none';
}, { passive: true });

lightbox.addEventListener('touchmove', (e) => {
  if (!isDragging) return;

  touchCurrentX = e.touches[0].clientX;
  touchCurrentY = e.touches[0].clientY;

  const deltaX = touchCurrentX - touchStartX;
  const deltaY = touchCurrentY - touchStartY;

  // Determine gesture direction on first significant movement
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
}, { passive: true });

lightbox.addEventListener('touchend', (e) => {
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
