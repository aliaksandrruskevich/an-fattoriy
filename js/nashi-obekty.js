document.addEventListener('DOMContentLoaded', function() {
  const propertiesContainer = document.getElementById('propertiesContainer');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const errorMessage = document.getElementById('errorMessage');
  const applyFiltersBtn = document.getElementById('applyFiltersBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const currentPageSpan = document.getElementById('currentPage');
  const totalPagesSpan = document.getElementById('totalPages');

  // Property detail view elements
  const propertiesListSection = document.getElementById('propertiesListSection');
  const propertyDetailSection = document.getElementById('propertyDetailSection');
  const backToListBtn = document.getElementById('backToListBtn');

  let allProperties = []; // Store all loaded properties
  let filteredProperties = []; // Store filtered properties
  let currentPage = 1;
  let totalPages = 1;
  let currentFilters = {};
  let isLoading = false;
  let currentView = 'list'; // 'list' or 'detail'

  // Initialize
  initializePage();

  // Event listeners
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', applyFilters);
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => navigatePage(currentPage - 1));
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => navigatePage(currentPage + 1));
  }

  // Property detail navigation
  if (backToListBtn) {
    backToListBtn.addEventListener('click', () => {
      history.back();
    });
  }

  // Intercept property link clicks for SPA navigation
  document.addEventListener('click', function(e) {
    const target = e.target.closest('.btn');
    if (target && target.textContent.trim() === 'Подробнее') {
      e.preventDefault();
      const href = target.getAttribute('href');
      if (href && href.startsWith('/object/')) {
        const unid = href.split('/object/')[1];
        navigateToProperty(unid);
      }
    }
  });

  // Handle browser back/forward buttons
  window.addEventListener('popstate', function(e) {
    const path = window.location.pathname;
    if (path.startsWith('/object/')) {
      const unid = path.split('/object/')[1];
      showPropertyDetail(unid);
    } else {
      showPropertyList();
    }
  });

  // Price range slider
  const priceRange = document.getElementById('priceRange');
  const minPriceSpan = document.getElementById('minPrice');
  const maxPriceSpan = document.getElementById('maxPrice');

  if (priceRange) {
    priceRange.addEventListener('input', function() {
      const value = parseInt(this.value);
      minPriceSpan.textContent = value.toLocaleString();
      maxPriceSpan.textContent = '500 000';
    });
  }

  function showLoading() {
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    if (errorMessage) errorMessage.style.display = 'none';
    isLoading = true;
  }

  function hideLoading() {
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    isLoading = false;
  }

  function showError(message) {
    hideLoading();
    if (errorMessage) {
      errorMessage.querySelector('p').textContent = message;
      errorMessage.style.display = 'block';
    }
  }

  function loadAllProperties() {
    if (isLoading) return;

    showLoading();

    // Load all 500 properties
    const url = `/api/properties.php?limit=500&offset=0`;

    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        hideLoading();
        allProperties = data || [];
        filteredProperties = [...allProperties];
        displayCurrentPage();
        updateNavigation();
      })
      .catch(error => {
        console.error('Error loading properties:', error);
        showError('Не удалось загрузить объекты. Попробуйте обновить страницу.');
      });
  }

  function applyFilters() {
    // Get filter values
    const typeSelect = document.querySelector('.filter-group select');
    const districtSelect = document.querySelectorAll('.filter-group select')[1];
    const roomsSelect = document.querySelectorAll('.filter-group select')[2];
    const priceRange = document.getElementById('priceRange');
    const areaMinInput = document.querySelector('.filter-group input[placeholder="от"]');
    const areaMaxInput = document.querySelector('.filter-group input[placeholder="до"]');

    currentFilters = {
      type: typeSelect ? typeSelect.value : '',
      district: districtSelect ? districtSelect.value : '',
      rooms: roomsSelect ? roomsSelect.value : '',
      price_min: priceRange ? parseInt(priceRange.value) : '',
      price_max: 500000,
      area_min: areaMinInput ? parseFloat(areaMinInput.value) : '',
      area_max: areaMaxInput ? parseFloat(areaMaxInput.value) : ''
    };

    // Filter properties based on current filters
    filteredProperties = allProperties.filter(property => {
      // Type filter
      if (currentFilters.type && currentFilters.type !== 'Все типы') {
        const typeMap = {
          'Квартира': 'квартира',
          'Дом': 'дом',
          'Коммерческая': 'коммерческая недвижимость',
          'Участок': 'участок'
        };
        const filterType = typeMap[currentFilters.type] || currentFilters.type;
        if (!property.type || !property.type.toLowerCase().includes(filterType.toLowerCase())) {
          return false;
        }
      }

      // Rooms filter
      if (currentFilters.rooms && currentFilters.rooms !== 'Любое') {
        const roomsFilter = parseInt(currentFilters.rooms);
        if (property.features) {
          const hasRooms = property.features.some(feature =>
            feature.includes(`Комнаты: ${roomsFilter}`)
          );
          if (!hasRooms) return false;
        }
      }

      // Price filter
      if (currentFilters.price_min && property.price < currentFilters.price_min) {
        return false;
      }
      if (currentFilters.price_max && property.price > currentFilters.price_max) {
        return false;
      }

      // Area filter
      if (currentFilters.area_min || currentFilters.area_max) {
        if (property.features) {
          const areaFeature = property.features.find(feature =>
            feature.includes('Площадь:')
          );
          if (areaFeature) {
            const areaMatch = areaFeature.match(/Площадь:\s*(\d+)/);
            if (areaMatch) {
              const area = parseFloat(areaMatch[1]);
              if (currentFilters.area_min && area < currentFilters.area_min) return false;
              if (currentFilters.area_max && area > currentFilters.area_max) return false;
            }
          }
        }
      }

      return true;
    });

    currentPage = 1;
    displayCurrentPage();
    updateNavigation();
  }

  function navigatePage(page) {
    if (page < 1 || page > totalPages || isLoading) return;
    currentPage = page;
    displayCurrentPage();
    updateNavigation();
  }

  function displayCurrentPage() {
    const startIndex = (currentPage - 1) * 8;
    const endIndex = startIndex + 8;
    const pageProperties = filteredProperties.slice(startIndex, endIndex);

    propertiesContainer.innerHTML = '';

    if (!pageProperties || pageProperties.length === 0) {
      propertiesContainer.innerHTML = '<div class="col-12"><div class="alert alert-info text-center">Объекты не найдены. Попробуйте изменить фильтры.</div></div>';
      return;
    }

    // Create 8-card grid (2 rows of 4)
    const row1 = document.createElement('div');
    row1.className = 'row mb-4';

    const row2 = document.createElement('div');
    row2.className = 'row';

    pageProperties.forEach((property, index) => {
      const propertyCard = createPropertyCard(property);
      if (index < 4) {
        row1.appendChild(propertyCard);
      } else {
        row2.appendChild(propertyCard);
      }
    });

    propertiesContainer.appendChild(row1);
    if (pageProperties.length > 4) {
      propertiesContainer.appendChild(row2);
    }
  }

  function updateNavigation() {
    totalPages = Math.ceil(filteredProperties.length / 8);
    if (currentPageSpan) currentPageSpan.textContent = currentPage;
    if (totalPagesSpan) totalPagesSpan.textContent = totalPages;

    if (prevBtn) {
      prevBtn.disabled = currentPage <= 1;
    }

    if (nextBtn) {
      nextBtn.disabled = currentPage >= totalPages;
    }
  }

  function createPropertyCard(property) {
    const col = document.createElement('div');
    col.className = 'col-lg-3 col-md-6 mb-4';

    const card = document.createElement('div');
    card.className = 'card property-card h-100';

    const img = document.createElement('img');
    img.className = 'card-img-top';
    img.src = property.photos && property.photos.length > 0 ? property.photos[0] : 'https://via.placeholder.com/300x200?text=Нет+фото';
    img.alt = property.title;
    img.loading = 'lazy';

    const cardBody = document.createElement('div');
    cardBody.className = 'card-body d-flex flex-column';

    const title = document.createElement('h6');
    title.className = 'card-title';
    title.textContent = property.title;

    const location = document.createElement('p');
    location.className = 'card-text text-muted small';
    location.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${property.location}`;

    const price = document.createElement('p');
    price.className = 'card-text fw-bold text-warning';
    price.textContent = formatPrice(property.price, property.currency);

    const features = document.createElement('p');
    features.className = 'card-text small';
    features.textContent = property.features ? property.features.slice(0, 2).join(', ') : '';

    const link = document.createElement('a');
    link.href = `/object/${property.unid}`;
    link.className = 'btn btn-warning btn-sm mt-auto';
    link.textContent = 'Подробнее';

    cardBody.appendChild(title);
    cardBody.appendChild(location);
    cardBody.appendChild(price);
    cardBody.appendChild(features);
    cardBody.appendChild(link);

    card.appendChild(img);
    card.appendChild(cardBody);
    col.appendChild(card);

    return col;
  }

  function formatPrice(price, currency = 'USD') {
    if (!price) return 'Цена по запросу';
    const symbols = { 'USD': '$', 'EUR': '€', 'BYN': 'руб', 'RUB': 'р' };
    return new Intl.NumberFormat('ru-RU').format(price) + ' ' + (symbols[currency] || currency);
  }

  // SPA Navigation Functions
  function initializePage() {
    const path = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    const unidFromQuery = urlParams.get('unid');

    if (unidFromQuery) {
      loadAllProperties().then(() => {
        showPropertyDetail(unidFromQuery);
      });
    } else if (path.startsWith('/object/')) {
      const unid = path.split('/object/')[1];
      loadAllProperties().then(() => {
        showPropertyDetail(unid);
      });
    } else {
      loadAllProperties();
    }
  }

  function navigateToProperty(unid) {
    // Update URL without reload
    history.pushState({ unid: unid }, '', `/object/${unid}`);
    showPropertyDetail(unid);
  }

  function showPropertyList() {
    currentView = 'list';
    propertiesListSection.style.display = 'block';
    propertyDetailSection.style.display = 'none';
    // Scroll to top
    window.scrollTo(0, 0);
  }

  function showPropertyDetail(unid) {
    currentView = 'detail';

    // Find property in loaded data
    const property = allProperties.find(p => p.unid === unid);
    if (!property) {
      // Try to load from API
      fetch(`/api/property/${unid}`)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(property => {
          displayPropertyDetail(property);
          propertiesListSection.style.display = 'none';
          propertyDetailSection.style.display = 'block';
          window.scrollTo(0, 0);
        })
        .catch(error => {
          console.error('Error loading property:', error);
          showPropertyList();
        });
      return;
    }

    displayPropertyDetail(property);
    propertiesListSection.style.display = 'none';
    propertyDetailSection.style.display = 'block';
    window.scrollTo(0, 0);
  }

  function displayPropertyDetail(property) {
    console.log('Displaying property:', property);

    // Update page title
    document.title = `${property.title} | АН ФАТТОРИЯ`;

    // Update main info
    const titleElement = document.getElementById('propertyTitle');
    if (titleElement) titleElement.textContent = property.title || 'Название не указано';

    const locationElement = document.getElementById('propertyLocation');
    if (locationElement) locationElement.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${property.location || 'Местоположение не указано'}`;

    const priceElement = document.getElementById('propertyPrice');
    if (priceElement) priceElement.textContent = formatPrice(property.price, property.currency);

    // Update gallery
    const photos = property.photos || [];
    const mainImageElement = document.getElementById('mainPropertyImage');
    if (mainImageElement) {
      if (photos.length > 0) {
        mainImageElement.src = photos[0];
      } else {
        mainImageElement.src = 'https://via.placeholder.com/800x600?text=Нет+фото';
      }
    }

    if (photos.length > 1) {
      const thumbnailGallery = document.getElementById('thumbnailGallery');
      if (thumbnailGallery) {
        thumbnailGallery.innerHTML = photos.slice(1, 7).map((photo, index) =>
          `<img src="${photo}" alt="Фото ${index + 2}" onclick="changeMainImage('${photo}')" class="${index === 0 ? 'active' : ''}">`
        ).join('');
      }
    }

    // Update features
    const featuresContainer = document.getElementById('propertyFeatures');
    if (featuresContainer) {
      if (property.features && property.features.length > 0) {
        featuresContainer.innerHTML = property.features.map(feature =>
          `<div class="feature-item">${feature}</div>`
        ).join('');
      } else {
        featuresContainer.innerHTML = '<div class="feature-item">Информация уточняется</div>';
      }
    }

    // Update description
    const descriptionElement = document.getElementById('propertyDescription');
    if (descriptionElement) descriptionElement.textContent = property.description || 'Описание отсутствует';

    // Update agent info
    const agentNameElement = document.getElementById('agentName');
    if (agentNameElement) agentNameElement.textContent = property.contact_name || 'Контактное лицо';

    const agentPhoneElement = document.getElementById('agentPhone');
    if (agentPhoneElement) {
      agentPhoneElement.innerHTML = property.contact_phone ?
        `<a href="tel:${property.contact_phone}">${property.contact_phone}</a>` :
        'Телефон не указан';
    }

    // Initialize map if available
    initPropertyMap(property);
  }

  function changeMainImage(src) {
    document.getElementById('mainPropertyImage').src = src;

    // Update active thumbnail
    document.querySelectorAll('.thumbnail-gallery img').forEach(img => {
      img.classList.remove('active');
    });
    if (event && event.target) {
      event.target.classList.add('active');
    }
  }

  function initPropertyMap(property) {
    if (typeof ymaps === 'undefined') return;

    ymaps.ready(() => {
      const mapContainer = document.getElementById('propertyMap');
      if (!mapContainer) return;

      let coords = [53.9045, 27.5615]; // Default to Minsk

      if (property.lat && property.lng) {
        coords = [property.lat, property.lng];
      } else {
        // Try to geocode location
        ymaps.geocode(property.location || 'Минск').then((res) => {
          const firstGeoObject = res.geoObjects.get(0);
          if (firstGeoObject) {
            coords = firstGeoObject.geometry.getCoordinates();
            updateMap(coords);
          }
        });
      }

      updateMap(coords);
    });

    function updateMap(coords) {
      const map = new ymaps.Map('propertyMap', {
        center: coords,
        zoom: 15,
        controls: ['zoomControl']
      });

      const placemark = new ymaps.Placemark(coords, {
        hintContent: property.title,
        balloonContent: `${property.title}<br>${property.location}`
      });

      map.geoObjects.add(placemark);
    }
  }

  // Contact form handling
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();

      // Show success message
      if (typeof showToast === 'function') {
        showToast('Спасибо за интерес! Наш специалист свяжется с вами в ближайшее время.', 'success');
      }

      // Reset form
      this.reset();
    });
  }
});
