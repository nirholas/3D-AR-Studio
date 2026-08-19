// Handing one model to the device's own AR viewer, from the browser.
//
// This is the path that actually puts an object on someone's floor at real
// size, with real tracking, real occlusion and real lighting: Apple's AR Quick
// Look on iOS and Google's Scene Viewer on Android. Both are native apps, so
// there is no feature-detectable API and UA branching is the correct answer
// here rather than a shortcut.
//
// The studio's own WebXR session is better still where it exists (it keeps the
// whole multi-model scene in-page), so `arCapability()` puts it first and these
// two are what everyone else gets instead of a camera-passthrough approximation.

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

/**
 * The best AR path this device can actually deliver, best first.
 *
 * 'webxr'      immersive-ar: the whole scene stays in the page, anchored.
 * 'quicklook'  iOS/iPadOS: ARKit placement of ONE model, in Apple's viewer.
 * 'sceneviewer' Android without WebXR: ARCore placement of ONE model.
 * 'none'       desktop and locked-down webviews: hand off to a phone instead.
 *
 * Never throws: a blocked or missing API is simply not that capability.
 *
 * @returns {Promise<'webxr'|'quicklook'|'sceneviewer'|'none'>}
 */
export async function arCapability() {
	try {
		if (navigator.xr && (await navigator.xr.isSessionSupported('immersive-ar'))) return 'webxr';
	} catch {
		// A throwing support probe is just "not webxr".
	}
	if (canUseQuickLook()) return 'quicklook';
	if (canUseSceneViewer()) return 'sceneviewer';
	return 'none';
}

/**
 * Open ONE model in the device's native AR viewer.
 *
 * On iOS the GLB is converted to USDZ on the device first (a real conversion via
 * three.js's USDZExporter, not a placeholder), which takes a second or two on a
 * typical prop, so pass `onProgress` and show it.
 *
 * @param {object} model
 * @param {string} model.src        https URL of the .glb
 * @param {string} [model.title]    Name shown in the AR viewer's banner
 * @param {string} [model.usdz]     A ready-made USDZ, skipping conversion
 * @param {object} [opts]
 * @param {(stage: 'download'|'parse'|'convert'|'open') => void} [opts.onProgress]
 * @param {string} [opts.fallbackUrl]  Where Android lands without ARCore
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<'quicklook'|'sceneviewer'|'none'>} which viewer opened
 */
export async function placeInYourSpace({ src, title = '', usdz = '' } = {}, {
	onProgress, fallbackUrl = '', signal,
} = {}) {
	if (!src && !usdz) throw new Error('ar-studio: nothing to place');

	if (canUseQuickLook()) {
		let href = usdz;
		if (!href) {
			// Imported here rather than at module scope so a page that never opens
			// native AR never downloads the exporter.
			const { glbUrlToUsdzBlob } = await import('./usdz.js');
			const blob = await glbUrlToUsdzBlob(src, { signal, onProgress });
			href = URL.createObjectURL(blob);
			// Quick Look reads the file when the anchor is activated, so the URL has
			// to outlive this call; a minute is far longer than the viewer needs and
			// still bounds the leak.
			setTimeout(() => URL.revokeObjectURL(href), 60000);
		}
		onProgress?.('open');
		openQuickLook(withQuickLookBanner(href, { title, callToAction: '' }));
		return 'quicklook';
	}

	if (canUseSceneViewer()) {
		onProgress?.('open');
		openSceneViewer(src, { title, fallbackUrl });
		return 'sceneviewer';
	}

	return 'none';
}

// Quick Look renders its banner on one line and truncates long strings itself;
// clamp the fields so a runaway prompt-as-name cannot fill the URL.
const BANNER_FIELD_MAX = 80;

/**
 * Append Quick Look banner fields to a USDZ URL as fragment parameters. This is
 * the one piece of page-controlled UI Apple allows inside the sealed viewer.
 *
 * Deliberately string surgery rather than `new URL()`: the USDZ here is usually
 * a blob: object URL, which URL parsing mangles.
 *
 * @param {string} url
 * @param {{title?: string, subtitle?: string, callToAction?: string}} [fields]
 * @returns {string}
 */
export function withQuickLookBanner(url, { title, subtitle, callToAction } = {}) {
	if (typeof url !== 'string' || !url) return url;
	const params = [];
	const push = (key, value) => {
		const v = typeof value === 'string' ? value.trim().slice(0, BANNER_FIELD_MAX) : '';
		if (v) params.push(`${key}=${encodeURIComponent(v)}`);
	};
	push('checkoutTitle', title);
	push('checkoutSubtitle', subtitle);
	push('callToAction', callToAction);
	if (!params.length) return url;
	const joined = params.join('&');
	return url.includes('#') ? `${url}&${joined}` : `${url}#${joined}`;
}
