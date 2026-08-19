// GLB to USDZ, in the browser.
//
// This is what makes "Place in your space" real on an iPhone. Apple's AR Quick
// Look is the only way to get true ARKit placement on iOS, and it reads USDZ,
// not glTF. There is no server here doing the conversion: the model is loaded
// into a scene, prepared, and exported with three.js's own USDZExporter, on the
// device, in a couple of seconds.
//
// Three preparation steps matter, and skipping any of them produces a model
// that loads but looks broken:
//
//   1. Skinned meshes are baked to static geometry. USDZExporter carries no
//      skeletons: it writes raw vertex attributes plus each node's world
//      matrix. Export a rigged character without baking and Quick Look shows a
//      collapsed pile with limbs balled at the hips.
//   2. Materials are coerced to MeshStandardMaterial. USDZ speaks
//      UsdPreviewSurface, which maps cleanly from Standard only; unlit, Phong
//      and Toon materials are dropped with a warning.
//   3. Missing normals are computed. Position-only meshes (decimated props,
//      procedural geometry) otherwise export flat and unlit.
//
// Ported from the three.ws USDZ pipeline (Apache-2.0).

import {
	BufferAttribute, Color, DoubleSide, Mesh, MeshStandardMaterial, Vector3,
} from 'three';
import { sharedGLTFLoader } from './loaders.js';

/**
 * CPU-skin one SkinnedMesh at its current pose, returning deformed positions in
 * the mesh's own local space. The caller must have updated world matrices.
 *
 * @param {import('three').SkinnedMesh} mesh
 * @returns {Float32Array} vertexCount * 3
 */
export function bakedLocalPositions(mesh) {
	const posAttr = mesh.geometry.getAttribute('position');
	const out = new Float32Array(posAttr.count * 3);
	const v = new Vector3();
	for (let i = 0; i < posAttr.count; i++) {
		v.fromBufferAttribute(posAttr, i);
		mesh.applyBoneTransform(i, v);
		out[i * 3] = v.x;
		out[i * 3 + 1] = v.y;
		out[i * 3 + 2] = v.z;
	}
	return out;
}

/** Replace every SkinnedMesh with a static Mesh frozen at the current pose. */
export function bakeSkinnedMeshes(scene) {
	scene.updateMatrixWorld(true);
	const skinned = [];
	scene.traverse((obj) => {
		if (obj.isSkinnedMesh && obj.skeleton?.bones?.length) skinned.push(obj);
	});

	for (const mesh of skinned) {
		if (!mesh.geometry.getAttribute('position')) continue;
		const baked = mesh.geometry.clone();
		baked.setAttribute('position', new BufferAttribute(bakedLocalPositions(mesh), 3));
		// Skinning data is meaningless on a static mesh and confuses the exporter.
		baked.deleteAttribute('skinIndex');
		baked.deleteAttribute('skinWeight');
		// Normals were authored for the bind pose; recompute so the shading
		// matches the geometry Quick Look actually receives.
		baked.computeVertexNormals();

		const replacement = new Mesh(baked, mesh.material);
		replacement.name = mesh.name;
		replacement.visible = mesh.visible;
		// applyBoneTransform returns local-space vertices, so the replacement
		// keeps the original's local transform and the exporter applies it.
		replacement.position.copy(mesh.position);
		replacement.quaternion.copy(mesh.quaternion);
		replacement.scale.copy(mesh.scale);

		const parent = mesh.parent || scene;
		parent.add(replacement);
		parent.remove(mesh);
	}
}

/** Coerce every material to MeshStandardMaterial, in place. */
export function coerceMaterialsToStandard(scene) {
	scene.traverse((obj) => {
		if (!obj.isMesh) return;
		const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
		mats.forEach((m, i) => {
			if (!m || m.isMeshStandardMaterial) return;
			const replacement = new MeshStandardMaterial({
				color: m.color ? m.color.clone() : new Color(0xffffff),
				map: m.map || null,
				normalMap: m.normalMap || null,
				roughness: typeof m.roughness === 'number' ? m.roughness : 0.85,
				metalness: typeof m.metalness === 'number' ? m.metalness : 0,
				transparent: !!m.transparent,
				opacity: typeof m.opacity === 'number' ? m.opacity : 1,
				side: m.side ?? DoubleSide,
			});
			if (Array.isArray(obj.material)) obj.material[i] = replacement;
			else obj.material = replacement;
		});
	});
}

/** Give every renderable mesh a normal attribute. */
export function ensureNormals(scene) {
	scene.traverse((obj) => {
		if (!obj.isMesh || !obj.geometry) return;
		if (obj.geometry.getAttribute('normal')) return;
		if (!obj.geometry.getAttribute('position')) return;
		obj.geometry.computeVertexNormals();
	});
}

/**
 * Convert a loaded scene to USDZ bytes. Mutates the scene, so pass a clone or a
 * scene you are done with.
 *
 * @param {import('three').Object3D} scene
 * @returns {Promise<Blob>} model/vnd.usdz+zip
 */
export async function sceneToUsdzBlob(scene) {
	bakeSkinnedMeshes(scene);
	coerceMaterialsToStandard(scene);
	ensureNormals(scene);
	// Loaded on demand: nobody who never taps "Place in your space" should pay
	// for the exporter.
	const { USDZExporter } = await import('three/addons/exporters/USDZExporter.js');
	const bytes = await new USDZExporter().parseAsync(scene);
	return new Blob([bytes], { type: 'model/vnd.usdz+zip' });
}

/**
 * Fetch a GLB and convert it to a USDZ blob.
 *
 * @param {string} glbUrl
 * @param {{signal?: AbortSignal, onProgress?: (stage: string) => void}} [opts]
 * @returns {Promise<Blob>}
 */
export async function glbUrlToUsdzBlob(glbUrl, { signal, onProgress } = {}) {
	onProgress?.('download');
	const res = await fetch(glbUrl, { signal });
	if (!res.ok) throw new Error(`model fetch ${res.status}`);
	const buffer = await res.arrayBuffer();

	onProgress?.('parse');
	const loader = sharedGLTFLoader();
	const gltf = await new Promise((resolve, reject) => {
		loader.parse(buffer, '', resolve, reject);
	});
	const scene = gltf.scene || gltf.scenes?.[0];
	if (!scene) throw new Error('that model contains no scene');

	onProgress?.('convert');
	return sceneToUsdzBlob(scene);
}
