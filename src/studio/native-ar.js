// Handing one model to the device's own AR viewer, from the browser.
//
// The studio's WebXR path keeps everything in-page; these two are the escape
// hatches for the platforms that do not expose it. Both are UA-branched on
// purpose: this is one of the few places where sniffing is the correct answer,
// because the two viewers are native apps with no feature-detectable API.

/** Apple's AR Quick Look, available on iOS and iPadOS Safari. */
export function isIOS() {
	if (typeof navigator === 'undefined') return false;
	return /iphone|ipad|ipod/i.test(navigator.userAgent)
		|| (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function canUseQuickLook() {
	return isIOS();
}

export function isAndroid() {
	return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
}

export function canUseSceneViewer() {
	return isAndroid();
}

// Safari delivers the Quick Look banner-tap `message` event on the anchor that
// launched the session, so the anchor must stay in the DOM while the viewer is
// open. One live anchor at a time: replacing it drops the previous listener.
let _anchor = null;

/** The literal `message` payload Safari sends when the Quick Look banner is tapped. */
export const QUICK_LOOK_BANNER_TAPPED = '_apple_ar_quicklook_button_tapped';

/**
 * Open a USDZ in Quick Look. Safari activates it when an `<a rel="ar">` is
 * clicked programmatically, which is why this builds an anchor rather than
 * navigating.
 *
 * @param {string} usdzUrl
 * @param {{onBannerTap?: () => void}} [opts]
 */
export function openQuickLook(usdzUrl, { onBannerTap } = {}) {
	if (_anchor) { _anchor.remove(); _anchor = null; }
	const a = document.createElement('a');
	a.rel = 'ar';
	a.href = usdzUrl;
	// iOS needs a child element for a programmatic click to open Quick Look.
	a.appendChild(document.createElement('img'));
	// Present but invisible. Deliberately not display:none: anchors removed from
	// layout are not reliably activated.
	a.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;';
	a.setAttribute('aria-hidden', 'true');
	if (typeof onBannerTap === 'function') {
		a.addEventListener('message', (e) => {
			if (e.data === QUICK_LOOK_BANNER_TAPPED) onBannerTap();
		});
	}
	document.body.appendChild(a);
	_anchor = a;
	a.click();
}

/**
 * Open a GLB in Google Scene Viewer through an ARCore intent. Falls the browser
 * back to `fallbackUrl` (default: this page) when ARCore is missing.
 *
 * @param {string} glbUrl
 * @param {{title?: string, link?: string, fallbackUrl?: string}} [opts]
 */
export function openSceneViewer(glbUrl, { title = '', link = '', fallbackUrl = '' } = {}) {
	const params = new URLSearchParams({ file: glbUrl, mode: 'ar_preferred' });
	if (title) params.set('title', title);
	if (link) params.set('link', link);
	const fallback = encodeURIComponent(fallbackUrl || location.href);
	location.href = `intent://arvr.google.com/scene-viewer/1.2?${params.toString()}`
		+ '#Intent;scheme=https;package=com.google.ar.core;'
		+ 'action=android.intent.action.VIEW;'
		+ `S.browser_fallback_url=${fallback};end;`;
}
