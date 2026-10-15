/**
 * Static preloader companion: sets quote text immediately and shows manual reload if React mount stalls.
 * Вынесено из index.html для CSP (script-src без unsafe-inline / eval).
 * Quote pool: `elite-quotes-inline.js` (generated from eliteQuotes/catalog/*.json).
 */
(() => {
	window.__ELITEEW_PRELOADER_STARTED_AT = performance.now();

	var fallbackQuotes = [
		{
			author: 'Ганнибал',
			text: 'Мы либо найдём дорогу, либо проложим её сами.',
		},
		{ author: 'Марк Аврелий', text: 'Препятствие на пути становится путём.' },
	];

	var quotes = (window.__ELITEEW_QUOTES__ || fallbackQuotes).map((entry) => ({
		author: entry.author,
		text: entry.text,
	}));

	var shuffleOrder = [];
	var shufflePos = 0;
	var lastQuoteIndex = -1;

	function reshuffleQuotes(excludeFirst) {
		var i, j, tmp, swap;
		shuffleOrder = quotes.map((_, idx) => idx);
		for (i = shuffleOrder.length - 1; i > 0; i -= 1) {
			j = Math.floor(Math.random() * (i + 1));
			tmp = shuffleOrder[i];
			shuffleOrder[i] = shuffleOrder[j];
			shuffleOrder[j] = tmp;
		}
		if (
			excludeFirst !== undefined &&
			shuffleOrder.length > 1 &&
			shuffleOrder[0] === excludeFirst
		) {
			swap = shuffleOrder[0];
			shuffleOrder[0] = shuffleOrder[1];
			shuffleOrder[1] = swap;
		}
		shufflePos = 0;
	}

	function pickQuote() {
		if (!quotes.length) {
			return { author: '', text: '' };
		}
		if (quotes.length === 1) {
			return quotes[0];
		}
		if (!shuffleOrder.length) {
			reshuffleQuotes();
		}
		if (shufflePos >= shuffleOrder.length) {
			reshuffleQuotes(lastQuoteIndex);
		}
		var index = shuffleOrder[shufflePos];
		shufflePos += 1;
		lastQuoteIndex = index;
		return quotes[index];
	}

	var QUOTE_ROTATION_MS = 7000;

	function applyQuote(root) {
		var quote = pickQuote();
		var text = root.querySelector('.preloader-quote-text');
		var author = root.querySelector('.preloader-quote-author');
		var block = root.querySelector('.preloader-quote');
		if (block) {
			block.classList.remove('preloader-quote-crossfade');
			void block.offsetWidth;
			block.classList.add('preloader-quote-crossfade');
		}
		if (text) text.textContent = `«${quote.text}»`;
		if (author) author.textContent = quote.author;
	}

	function showSlowFallback() {
		var preloader = document.getElementById('app-preloader');
		if (!preloader || preloader.classList.contains('hidden')) return;

		preloader.replaceChildren();

		var card = document.createElement('div');
		card.className = 'preloader-card';

		var logoWrap = document.createElement('div');
		logoWrap.className = 'preloader-logo';
		var logoInner = document.createElement('div');
		logoInner.className = 'preloader-logo-inner';
		var logoMark = document.createElement('div');
		logoMark.className = 'preloader-logo-mark';
		logoInner.appendChild(logoMark);
		logoWrap.appendChild(logoInner);

		var title = document.createElement('div');
		title.className = 'preloader-title';
		title.textContent = 'EliteEW';

		var scale = document.createElement('div');
		scale.className = 'preloader-progress-scale';
		var scaleStart = document.createElement('span');
		scaleStart.textContent = '0%';
		var scaleEnd = document.createElement('span');
		scaleEnd.textContent = '100%';
		scale.appendChild(scaleStart);
		scale.appendChild(scaleEnd);

		var progress = document.createElement('div');
		progress.className = 'preloader-progress';
		progress.setAttribute('role', 'progressbar');
		progress.setAttribute('aria-valuemin', '0');
		progress.setAttribute('aria-valuemax', '100');
		progress.setAttribute('aria-valuenow', '99');
		var bar = document.createElement('div');
		bar.className = 'preloader-progress-bar';
		progress.appendChild(bar);

		var quote = document.createElement('blockquote');
		quote.className = 'preloader-quote';
		var quoteText = document.createElement('p');
		quoteText.className = 'preloader-quote-text';
		var quoteAuthor = document.createElement('cite');
		quoteAuthor.className = 'preloader-quote-author';
		quote.appendChild(quoteText);
		quote.appendChild(quoteAuthor);

		var hint = document.createElement('div');
		hint.className = 'preloader-hint';
		hint.textContent =
			'Безраздельный мир открывается дольше обычного. Данные и раскладка сохраняются.';

		var btn = document.createElement('button');
		btn.type = 'button';
		btn.textContent = 'Проверить связь';
		btn.className = 'preloader-action';
		btn.addEventListener('click', () => {
			location.reload();
		});

		card.appendChild(logoWrap);
		card.appendChild(title);
		card.appendChild(scale);
		card.appendChild(progress);
		card.appendChild(quote);
		card.appendChild(hint);
		card.appendChild(btn);
		preloader.appendChild(card);
		applyQuote(card);
	}

	var preloader = document.getElementById('app-preloader');
	if (preloader) {
		applyQuote(preloader);
		if (quotes.length > 1) {
			setInterval(() => {
				if (!preloader.classList.contains('hidden')) {
					applyQuote(preloader);
				}
			}, QUOTE_ROTATION_MS);
		}
	}
	setTimeout(showSlowFallback, 10000);
})();
