function getRootPath() {
  const appScript = document.querySelector('script[src$="app.js"], script[src*="app.js?"]');

  if (appScript && appScript.src) {
    const rootUrl = new URL('.', appScript.src);
    return rootUrl.href.replace(/\/$/, '');
  }

  return document.body.dataset.root || '.';
}

async function injectPartial(target) {
  const partialName = target.dataset.include;

  if (!partialName) {
    return;
  }

  const rootPath = getRootPath();
  const response = await fetch(`${rootPath}/partials/${partialName}.html`);

  if (!response.ok) {
    throw new Error(`Failed to load partial: ${partialName}`);
  }

  const markup = await response.text();
  target.innerHTML = markup.replaceAll('{{ROOT}}', rootPath);
}

let publicationCitationFormats = new Map();

function setupNav() {
  const navToggle = document.querySelector('[data-nav-toggle]');
  const navLinks = document.querySelector('[data-nav-links]');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
  }
}

function setCurrentYear() {
  const currentYear = document.querySelector('[data-current-year]');

  if (currentYear) {
    currentYear.textContent = String(new Date().getFullYear());
  }
}

function setActiveNav() {
  const currentPage = document.body.dataset.page;
  const activeLink = currentPage
    ? document.querySelector(`[data-nav-page="${currentPage}"]`)
    : null;

  if (activeLink) {
    activeLink.classList.add('is-active');
  }
}

function getHomeFaqBubbleLabel(id) {
  return String(id || '')
    .replace(/^bubble-/, '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getFaqTopicKey(id) {
  return String(id || '').replace(/^(bubble|arrow)-/, '');
}

function getScaledTransform(element, scale) {
  const baseTransform = element.getAttribute('data-base-transform') || '';
  const bbox = element.getBBox();
  const centerX = bbox.x + bbox.width / 2;
  const centerY = bbox.y + bbox.height / 2;
  const scaleTransform = `translate(${centerX} ${centerY}) scale(${scale}) translate(${-centerX} ${-centerY})`;

  return baseTransform ? `${baseTransform} ${scaleTransform}` : scaleTransform;
}

async function renderHomeFaqGraphic() {
  if (document.body.dataset.page !== 'home') {
    return;
  }

  const target = document.querySelector('[data-home-faq-graphic]');
  const source = target?.dataset.homeFaqSrc;

  if (!target || !source) {
    return;
  }

  const svgUrl = new URL(source, `${getRootPath()}/`).href;
  const response = await fetch(svgUrl);

  if (!response.ok) {
    throw new Error('Failed to load homepage FAQ graphic');
  }

  target.innerHTML = await response.text();

  const svg = target.querySelector('svg');

  if (!svg) {
    return;
  }

  svg.classList.add('faq-graphic');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const bubbleGroups = Array.from(svg.querySelectorAll('g[id^="bubble-"]'));
  const arrowGroups = Array.from(svg.querySelectorAll('g[id^="arrow-"]'));
  const arrowByTopic = new Map(
    arrowGroups.map((group) => [getFaqTopicKey(group.id), group])
  );

  bubbleGroups.forEach((group) => {
    const label = getHomeFaqBubbleLabel(group.id);
    const topicKey = getFaqTopicKey(group.id);
    const relatedArrow = arrowByTopic.get(topicKey) || null;

    group.classList.add('faq-bubble');
    group.setAttribute('data-base-transform', group.getAttribute('transform') || '');
    group.setAttribute('tabindex', '0');
    group.setAttribute('role', 'img');
    group.setAttribute('aria-label', label);
    group.dataset.bubbleLabel = label;
    group.dataset.faqTopic = topicKey;

    if (relatedArrow) {
      relatedArrow.classList.add('faq-arrow');
      relatedArrow.setAttribute('data-base-transform', relatedArrow.getAttribute('transform') || '');
      relatedArrow.dataset.faqTopic = topicKey;
    }

    const setHoveredState = (isHovered) => {
      group.classList.toggle('is-hovered', isHovered);
      group.setAttribute('transform', isHovered ? getScaledTransform(group, 1.04) : group.getAttribute('data-base-transform') || '');

      if (relatedArrow) {
        relatedArrow.classList.toggle('is-hovered', isHovered);
        relatedArrow.setAttribute(
          'transform',
          isHovered ? getScaledTransform(relatedArrow, 1.05) : relatedArrow.getAttribute('data-base-transform') || ''
        );
      }
    };

    group.addEventListener('pointerenter', () => {
      setHoveredState(true);
    });
    group.addEventListener('pointerleave', () => {
      setHoveredState(false);
    });
    group.addEventListener('focus', () => {
      setHoveredState(true);
    });
    group.addEventListener('blur', () => {
      setHoveredState(false);
    });
  });
}

function formatPublicationDate(dateString, fallbackYear) {
  if (!dateString) {
    return String(fallbackYear || '');
  }
  return String(dateString);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getQueryTerms(query) {
  return String(query || '')
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function highlightText(value, queryTerms) {
  const escapedValue = escapeHtml(value || '');

  if (!queryTerms.length) {
    return escapedValue;
  }

  const pattern = queryTerms
    .map(escapeRegExp)
    .sort((a, b) => b.length - a.length)
    .join('|');

  if (!pattern) {
    return escapedValue;
  }

  return escapedValue.replace(new RegExp(`(${pattern})`, 'gi'), '<mark class="publication-highlight">$1</mark>');
}

function normalizeTag(tag) {
  return String(tag || '').toLowerCase();
}

function buildTagMarkup(tags, activeTags, queryTerms) {
  return tags
    .map((tag) => {
      const escapedTag = escapeHtml(tag);
      const isActive = activeTags.has(normalizeTag(tag)) ? ' is-active' : '';

      return `
        <button
          class="publication-tag publication-tag-button${isActive}"
          type="button"
          data-publication-filter="${escapedTag}"
        >
          ${highlightText(tag, queryTerms)}
        </button>
      `;
    })
    .join('');
}

function buildPublicationTitleMarkup(publication, queryTerms) {
  const title = highlightText(publication.title || '', queryTerms);
  const url = publication.url ? escapeHtml(publication.url) : '';

  if (!url) {
    return `<h2 class="publication-title">${title}</h2>`;
  }

  return `
    <h2 class="publication-title">
      <a
        class="publication-title-link"
        href="${url}"
        target="_blank"
        rel="noreferrer"
      >
        ${title}
      </a>
    </h2>
  `;
}

function formatDisplayAuthor(author) {
  if (typeof author === 'string') {
    return author.trim().replace(/[;,]\s*$/, '');
  }

  if (!author || typeof author !== 'object') {
    return '';
  }

  const name = author.name || author.fullName || '';
  const title = author.title || author.credentials || '';

  if (!name) {
    return '';
  }

  return title ? `${name}, ${title}` : name;
}

function buildPublicationMarkup(publication) {
  const authors = Array.isArray(publication.authors)
    ? publication.authors.map(formatDisplayAuthor).filter(Boolean).join('; ')
    : '';
  const queryTerms = publication.__queryTerms || [];
  const activeTags = publication.__activeTags || new Set();

  return `
    <article class="publication-entry">
      <div class="publication-entry-head">
        ${buildPublicationTitleMarkup(publication, queryTerms)}
        <button
          class="cite-button"
          type="button"
          data-publication-id="${escapeHtml(publication.id || '')}"
        >
          Cite
        </button>
      </div>
      <p class="publication-authors">${highlightText(authors, queryTerms)}</p>
      <div class="publication-tags">
        ${buildTagMarkup(Array.isArray(publication.tags) ? publication.tags : [], activeTags, queryTerms)}
      </div>
    </article>
  `;
}

function groupPublicationsByYear(publications) {
  return publications.reduce((groups, publication) => {
    const year = String(publication.year || 'Undated');

    if (!groups[year]) {
      groups[year] = [];
    }

    groups[year].push(publication);
    return groups;
  }, {});
}

function getPublicationSortValue(publication) {
  if (publication.sortDate) {
    const sortTime = new Date(publication.sortDate).getTime();

    if (!Number.isNaN(sortTime)) {
      return sortTime;
    }
  }

  if (publication.year) {
    return new Date(Number(publication.year), 0, 1).getTime();
  }

  return 0;
}

function formatAuthorList(authors, conjunction) {
  if (!authors.length) {
    return '';
  }

  if (authors.length === 1) {
    return authors[0];
  }

  if (authors.length === 2) {
    return `${authors[0]} ${conjunction} ${authors[1]}`;
  }

  return `${authors.slice(0, -1).join(', ')}, ${conjunction} ${authors[authors.length - 1]}`;
}

function formatVenueDetails(publication) {
  const parts = [];

  if (publication.journal) {
    parts.push(publication.journal);
  }

  let volumeIssue = '';

  if (publication.volume) {
    volumeIssue += publication.volume;
  }

  if (publication.issue) {
    volumeIssue += `(${publication.issue})`;
  }

  if (volumeIssue) {
    parts.push(volumeIssue);
  }

  if (publication.pages) {
    parts.push(publication.pages);
  }

  return parts.join(', ');
}

function buildBibtexKey(publication) {
  const base = String(publication.id || publication.title || 'publication')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return base || 'publication';
}

function generateCitationFormats(publication) {
  const authors = Array.isArray(publication.authors) ? publication.authors : [];
  const year = publication.year ? String(publication.year) : 'n.d.';
  const title = publication.title || '';
  const venueDetails = formatVenueDetails(publication);
  const doiLink = publication.doi ? ` https://doi.org/${publication.doi}` : publication.url ? ` ${publication.url}` : '';
  const apa = publication.citation ||
    `${formatAuthorList(authors, '&')} (${year}). ${title}. ${venueDetails}.${doiLink}`.trim();
  const mlaAuthors =
    authors.length > 2
      ? `${authors[0]}, et al.`
      : authors.length === 2
        ? `${authors[0]}, and ${authors[1]}`
        : authors[0] || '';
  const mla = `${mlaAuthors} "${title}." ${venueDetails}, ${year}.${doiLink}`.replace(/\s+/g, ' ').trim();
  const chicago = `${formatAuthorList(authors, 'and')}. ${year}. "${title}." ${venueDetails}.${doiLink}`
    .replace(/\s+/g, ' ')
    .trim();
  const bibtex = `@article{${buildBibtexKey(publication)},
  title = {${title}},
  author = {${authors.join(' and ')}},
  year = {${year}},
  journal = {${publication.journal || ''}},
  volume = {${publication.volume || ''}},
  number = {${publication.issue || ''}},
  pages = {${publication.pages || ''}},
  doi = {${publication.doi || ''}},
  url = {${publication.url || ''}}
}`;

  return {
    apa,
    mla,
    chicago,
    bibtex,
  };
}

function buildPublicationSearchText(publication) {
  return [
    publication.title,
    (publication.authors || []).join(' '),
    (publication.tags || []).join(' '),
    publication.type,
    publication.journal,
    publication.doi,
    publication.citation,
    publication.publishedDate,
    publication.year,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function publicationMatchesQuery(publication, query) {
  const queryTerms = getQueryTerms(query);

  if (!queryTerms.length) {
    return true;
  }

  const haystack = buildPublicationSearchText(publication);
  return queryTerms.every((term) => haystack.includes(term));
}

function publicationMatchesTags(publication, activeTags) {
  if (!activeTags.size) {
    return true;
  }

  const publicationTags = new Set((publication.tags || []).map(normalizeTag));
  return Array.from(activeTags).every((tag) => publicationTags.has(tag));
}

function buildTagSummary(publications, activeTags, queryTerms) {
  const counts = new Map();

  publications.forEach((publication) => {
    (publication.tags || []).forEach((tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([tag, count]) => {
      const escapedTag = escapeHtml(tag);
      const isActive = activeTags.has(normalizeTag(tag)) ? ' is-active' : '';

      return `
        <button
          class="publication-tag publication-tag-summary publication-tag-button${isActive}"
          type="button"
          data-publication-filter="${escapedTag}"
        >
          ${highlightText(tag, queryTerms)}
          <span class="publication-tag-count">${count}</span>
        </button>
      `;
    })
    .join('');
}

function setupCitationModal() {
  const modal = document.querySelector('[data-cite-modal]');
  const closeButton = document.querySelector('[data-cite-close]');
  const copyButton = document.querySelector('[data-copy-citation]');
  const textTarget = document.querySelector('[data-cite-text]');
  const formatButtons = Array.from(document.querySelectorAll('[data-cite-format]'));
  let activeFormats = null;
  let activeFormat = 'apa';

  if (!modal || !closeButton || !copyButton || !textTarget || !formatButtons.length) {
    return;
  }

  function updateCitationText() {
    if (!activeFormats) {
      textTarget.textContent = '';
      return;
    }

    textTarget.textContent = activeFormats[activeFormat] || activeFormats.apa || '';

    formatButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.citeFormat === activeFormat);
    });
  }

  document.addEventListener('click', async (event) => {
    const citeButton = event.target.closest('[data-publication-id]');

    if (!citeButton) {
      return;
    }

    const publicationId = citeButton.dataset.publicationId || '';
    activeFormats = publicationCitationFormats.get(publicationId) || null;
    activeFormat = 'apa';
    updateCitationText();
    modal.showModal();
  });

  closeButton.addEventListener('click', () => {
    modal.close();
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.close();
    }
  });

  formatButtons.forEach((button) => {
    button.addEventListener('click', () => {
      activeFormat = button.dataset.citeFormat || 'apa';
      updateCitationText();
    });
  });

  copyButton.addEventListener('click', async () => {
    const citation = textTarget.textContent || '';

    if (!citation) {
      return;
    }

    await navigator.clipboard.writeText(citation);
    copyButton.textContent = 'Copied';

    window.setTimeout(() => {
      copyButton.textContent = 'Copy citation';
    }, 1400);
  });
}

function renderPublicationGroups(publications, listTarget, emptyTarget, activeTags, queryTerms) {
  const grouped = groupPublicationsByYear(publications);
  const years = Object.keys(grouped).sort((a, b) => Number(b) - Number(a));

  if (!years.length) {
    listTarget.innerHTML = '';

    if (emptyTarget) {
      emptyTarget.hidden = false;
    }

    return;
  }

  if (emptyTarget) {
    emptyTarget.hidden = true;
  }

  listTarget.innerHTML = years
    .map((year) => {
      const items = grouped[year]
        .map((publication) => {
          return buildPublicationMarkup({
            ...publication,
            __activeTags: activeTags,
            __queryTerms: queryTerms,
          });
        })
        .join('');

      return `
        <section class="publication-year-group">
          <div class="publication-year">${escapeHtml(year)}</div>
          <div class="publication-year-items">
            ${items}
          </div>
        </section>
      `;
    })
    .join('');
}

async function renderPublicationsPage() {
  if (document.body.dataset.page !== 'publications') {
    return;
  }

  const listTarget = document.querySelector('[data-publications-list]');
  const tagTarget = document.querySelector('[data-publication-tags]');
  const searchInput = document.querySelector('[data-publication-search]');
  const emptyTarget = document.querySelector('[data-publications-empty]');
  const clearButton = document.querySelector('[data-publication-clear]');

  if (!listTarget || !tagTarget || !searchInput || !clearButton) {
    return;
  }

  const response = await fetch(`${getRootPath()}/data/publications.json`);

  if (!response.ok) {
    throw new Error('Failed to load publications data');
  }

  const data = await response.json();
  const publications = Array.isArray(data.publications) ? data.publications.slice() : [];
  const activeTags = new Set();
  publicationCitationFormats = new Map(
    publications.map((publication) => [publication.id, generateCitationFormats(publication)])
  );

  publications.sort((a, b) => {
    return getPublicationSortValue(b) - getPublicationSortValue(a);
  });

  const renderFilteredState = () => {
    const rawQuery = searchInput.value || '';
    const queryTerms = getQueryTerms(rawQuery);
    const filteredPublications = publications.filter((publication) => {
      return (
        publicationMatchesQuery(publication, rawQuery) &&
        publicationMatchesTags(publication, activeTags)
      );
    });

    tagTarget.innerHTML = buildTagSummary(publications, activeTags, queryTerms);
    renderPublicationGroups(filteredPublications, listTarget, emptyTarget, activeTags, queryTerms);
    clearButton.disabled = !rawQuery.trim() && !activeTags.size;
  };

  setupCitationModal();
  renderFilteredState();

  searchInput.addEventListener('input', (event) => {
    renderFilteredState();
  });

  tagTarget.addEventListener('click', (event) => {
    const filterButton = event.target.closest('[data-publication-filter]');

    if (!filterButton) {
      return;
    }

    const value = filterButton.dataset.publicationFilter || '';
    const normalizedValue = normalizeTag(value);

    if (activeTags.has(normalizedValue)) {
      activeTags.delete(normalizedValue);
    } else {
      activeTags.add(normalizedValue);
    }

    renderFilteredState();
  });

  listTarget.addEventListener('click', (event) => {
    const filterButton = event.target.closest('[data-publication-filter]');

    if (!filterButton) {
      return;
    }

    const value = filterButton.dataset.publicationFilter || '';
    const normalizedValue = normalizeTag(value);

    if (activeTags.has(normalizedValue)) {
      activeTags.delete(normalizedValue);
    } else {
      activeTags.add(normalizedValue);
    }

    renderFilteredState();
  });

  clearButton.addEventListener('click', () => {
    searchInput.value = '';
    activeTags.clear();
    renderFilteredState();
    searchInput.focus();
  });
}

async function bootstrapPage() {
  const partialTargets = Array.from(document.querySelectorAll('[data-include]'));

  await Promise.all(partialTargets.map(injectPartial));

  setActiveNav();
  setupNav();
  setCurrentYear();
  await renderHomeFaqGraphic();
  await renderPublicationsPage();
}

bootstrapPage().catch((error) => {
  console.error(error);
});
