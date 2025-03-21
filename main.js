import * as THREE from 'three';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Room setup (gradient background)
scene.background = new THREE.Color(0xf0f0f0);
const roomGeometry = new THREE.BoxGeometry(100, 70, 100);
const roomMaterial = new THREE.MeshStandardMaterial({
    side: THREE.BackSide,
    color: 0x222222,
    metalness: 1,
    roughness: 0.6
});
const room = new THREE.Mesh(roomGeometry, roomMaterial);
scene.add(room);

// Moving light setup
const light = new THREE.PointLight(0xffffff, 30000);
light.position.set(
    Math.random() * 100 - 50, // Random X between -50 and 50
    Math.random() * 80 - 40,  // Random Y between -40 and 40
    Math.random() * 20 - 10   // Random Z between -10 and 10
);
scene.add(light);

// Second moving light
const light2 = new THREE.PointLight(0xffffff, 30000);
light2.position.set(
    -(Math.random() * 100 - 50), // Opposite side X between -50 and 50
    -(Math.random() * 80 - 40),  // Opposite side Y between -40 and 40
    Math.random() * 20 + 10      // Random Z between 10 and 30
);
scene.add(light2);

// Ambient light for better visibility
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// Define cube size constant first
const CUBE_SIZE = 12;

// Create main cube composed of smaller cubes
const SEGMENTS = 8;
const SUBCUBE_SIZE = CUBE_SIZE / SEGMENTS;
const cubeGroup = new THREE.Group();
const subcubes = [];

// Custom shader for concrete texture
const concreteShader = {
    uniforms: {
        time: { value: 0 },
        variation: { value: 0 },
        cubeSize: { value: CUBE_SIZE }
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;

        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float variation;
        uniform float cubeSize;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;

        // Noise functions
        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
        }

        float noise(vec2 st) {
            vec2 i = floor(st);
            vec2 f = fract(st);

            float a = random(i);
            float b = random(i + vec2(1.0, 0.0));
            float c = random(i + vec2(0.0, 1.0));
            float d = random(i + vec2(1.0, 1.0));

            vec2 u = f * f * (3.0 - 2.0 * f);

            return mix(a, b, u.x) +
                    (c - a)* u.y * (1.0 - u.x) +
                    (d - b) * u.x * u.y;
        }

        float fbm(vec2 st) {
            float value = 0.0;
            float amplitude = 0.5;
            float frequency = 0.0;
            
            for(int i = 0; i < 5; i++) {
                value += amplitude * noise(st);
                st *= 2.0;
                amplitude *= 0.5;
            }
            return value;
        }

        vec3 getVariationColor(float v, vec2 st, float n, float imp) {
            // Base colors for each variation (24 variations total)
            vec3 colors[24] = vec3[24](
                // All greys made much darker
                vec3(0.067, 0.067, 0.067),  // Dark grey 1
                vec3(0.045, 0.045, 0.045),  // Dark grey 2
                vec3(0.058, 0.058, 0.058),  // Dark grey 3
                vec3(0.042, 0.042, 0.042),  // Dark grey 4
                vec3(0.049, 0.049, 0.049),  // Dark grey 5
                vec3(0.054, 0.054, 0.054),  // Dark grey 6
                vec3(0.061, 0.061, 0.061),  // Dark grey 7
                vec3(0.043, 0.043, 0.043),  // Dark grey 8
                vec3(0.056, 0.056, 0.056),  // Dark grey 9
                vec3(0.040, 0.040, 0.040),  // Dark grey 10
                vec3(0.047, 0.047, 0.047),  // Dark grey 11
                vec3(0.055, 0.055, 0.055),  // Dark grey 12
                vec3(0.063, 0.063, 0.063),  // Dark grey 13
                vec3(0.039, 0.039, 0.039),  // Dark grey 14
                vec3(0.048, 0.048, 0.048),  // Dark grey 15
                vec3(0.052, 0.052, 0.052),  // Dark grey 16
                vec3(0.046, 0.046, 0.046),  // Dark grey 17
                vec3(0.041, 0.041, 0.041),  // Dark grey 18
                vec3(0.050, 0.050, 0.050),  // Dark grey 19
                vec3(0.044, 0.044, 0.044),  // Dark grey 20
                vec3(0.057, 0.057, 0.057),  // Dark grey 21
                vec3(0.038, 0.038, 0.038),  // Dark grey 22
                vec3(0.052, 0.052, 0.052),  // Dark grey 23
                vec3(0.053, 0.053, 0.053)   // Dark grey 24
            );

            // Pattern variations modified for seamless transition
            float patterns[24] = float[24](
                // All patterns modified to be organic and seamless
                n * 0.15 + fbm(st*2.0) * 0.08,    // Basic concrete
                n * 0.12 + fbm(st*3.0) * 0.1,     // Rough concrete
                n * 0.14 + fbm(st*2.5) * 0.09,    // Medium concrete
                n * 0.16 + fbm(st*3.5) * 0.07,    // Coarse concrete
                n * 0.13 + fbm(st*4.0) * 0.06,    // Fine concrete
                n * 0.17 + fbm(st*2.8) * 0.08,    // Porous concrete
                n * 0.11 + fbm(st*3.2) * 0.09,    // Dense concrete
                n * 0.15 + fbm(st*2.6) * 0.07,    // Smooth concrete
                n * 0.14 + fbm(st*3.8) * 0.06,    // Weathered concrete
                n * 0.16 + fbm(st*2.4) * 0.08,    // Aged concrete
                n * 0.13 + fbm(st*3.4) * 0.07,    // Textured concrete
                n * 0.15 + fbm(st*2.9) * 0.09,    // Grainy concrete
                n * 0.12 + fbm(st*3.6) * 0.08,    // Mottled concrete
                n * 0.16 + fbm(st*2.7) * 0.07,    // Speckled concrete
                n * 0.14 + fbm(st*3.3) * 0.06,    // Eroded concrete
                n * 0.13 + fbm(st*2.8) * 0.08,    // Pitted concrete
                n * 0.15 + fbm(st*3.7) * 0.07,    // Worn concrete
                n * 0.12 + fbm(st*2.5) * 0.09,    // Raw concrete
                n * 0.16 + fbm(st*3.1) * 0.08,    // Natural concrete
                n * 0.14 + fbm(st*2.9) * 0.07,    // Organic concrete
                n * 0.13 + fbm(st*3.5) * 0.06,    // Uneven concrete
                n * 0.15 + fbm(st*2.6) * 0.08,    // Distressed concrete
                n * 0.12 + fbm(st*3.2) * 0.07,    // Irregular concrete
                n * 0.16 + fbm(st*2.8) * 0.09     // Rough-hewn concrete
            );

            // Imperfection strengths adjusted for more organic look
            float imperfectionStrength[24] = float[24](
                0.15, 0.18, 0.14, 0.16, 0.13, 0.17,
                0.16, 0.14, 0.17, 0.15, 0.18, 0.13,
                0.16, 0.15, 0.17, 0.14, 0.16, 0.18,
                0.15, 0.17, 0.14, 0.16, 0.15, 0.17
            );
            
            vec3 baseColor = colors[int(v)];
            float pattern = patterns[int(v)];
            
            vec3 color = baseColor + vec3(pattern - 0.075);
            color += vec3(imp * imperfectionStrength[int(v)]);
            
            return color;
        }

        void main() {
            // Use world position for seamless texturing
            vec2 globalSt = vWorldPosition.xy / cubeSize * 8.0;
            float n = fbm(globalSt);
            float imp = fbm(globalSt * 4.0);
            
            vec3 color = getVariationColor(variation, globalSt, n, imp);
            
            // Add edge darkening
            float edgeEffect = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 0.5) * 0.3;
            color = mix(color, color * 0.8, edgeEffect);

            gl_FragColor = vec4(color, 1.0);
        }
    `
};

for (let x = 0; x < SEGMENTS; x++) {
    for (let y = 0; y < SEGMENTS; y++) {
        for (let z = 0; z < SEGMENTS; z++) {
            const geometry = new THREE.BoxGeometry(SUBCUBE_SIZE, SUBCUBE_SIZE, SUBCUBE_SIZE);
            const material = new THREE.MeshPhongMaterial({
                color: 0x444444,
                shininess: 0,
                specular: 0x000000
            });

            // Enable UV coordinates in the material
            material.defines = {
                USE_UV: ''
            };

            // Add custom shader modifications
            material.onBeforeCompile = (shader) => {
                // Add uniforms
                shader.uniforms.variation = { value: Math.floor(Math.random() * 24) };
                shader.uniforms.cubeSize = { value: CUBE_SIZE };
                
                // Add our custom functions before main
                const customFunctions = concreteShader.fragmentShader
                    .split('void main() {')[0]
                    .replace(/uniform float variation;[\s\S]*?varying vec3 vWorldPosition;/, '');
                
                // Add vWorldPosition to vertex shader declarations
                shader.vertexShader = shader.vertexShader.replace(
                    '#include <common>',
                    '#include <common>\nvarying vec3 vWorldPosition;'
                );

                // Add world position calculation to vertex shader
                shader.vertexShader = shader.vertexShader.replace(
                    '#include <begin_vertex>',
                    `#include <begin_vertex>
                    vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
                    vWorldPosition = worldPosition.xyz;`
                );
                
                // Add varyings and uniforms to fragment shader
                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <common>',
                    `#include <common>
                    uniform float variation;
                    uniform float cubeSize;
                    varying vec3 vWorldPosition;
                    ${customFunctions}`
                );

                // Replace the color calculation
                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <color_fragment>',
                    `
                    #include <color_fragment>
                    vec2 globalSt = vWorldPosition.xy / cubeSize * 8.0;
                    float n = fbm(globalSt);
                    float imp = fbm(globalSt * 4.0);
                    vec3 concreteColor = getVariationColor(variation, globalSt, n, imp);
                    
                    float edgeEffect = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 0.5) * 0.3;
                    concreteColor = mix(concreteColor, concreteColor * 0.8, edgeEffect);
                    
                    diffuseColor.rgb *= concreteColor;
                    `
                );
            };

            const cube = new THREE.Mesh(geometry, material);
            
            // Position each subcube
            cube.position.set(
                (x - SEGMENTS/2 + 0.5) * SUBCUBE_SIZE,
                (y - SEGMENTS/2 + 0.5) * SUBCUBE_SIZE,
                (z - SEGMENTS/2 + 0.5) * SUBCUBE_SIZE
            );
            
            // Store original position for animation
            cube.userData.originalPosition = cube.position.clone();
            cube.userData.randomOffset = new THREE.Vector3(
                Math.random() * 2 - 1,
                Math.random() * 2 - 1,
                Math.random() * 2 - 1
            );
            
            subcubes.push(cube);
            cubeGroup.add(cube);
        }
    }
}

scene.add(cubeGroup);
camera.position.z = 20;

// Cube position limits and zoom settings
const MIN_DISTANCE = 0.001;
const MAX_DISTANCE = 30;
const ZOOM_SPEED = 1;
const ZOOM_SMOOTHNESS = 0.08;
let targetZPosition = -15;
cubeGroup.position.z = -15;

// Mouse wheel zoom
function onMouseWheel(event) {
    // Normalize wheel delta
    const delta = Math.sign(event.deltaY);
    
    // Update target position with variable speed based on distance
    const currentDistance = -targetZPosition;
    const speedMultiplier = currentDistance < 1 ? 0.1 : 0.3; // Slower speed when very close
    const newDistance = currentDistance + delta * ZOOM_SPEED * speedMultiplier;
    targetZPosition = -Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, newDistance));
}

window.addEventListener('wheel', onMouseWheel);

// Raycaster for mouse interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let isHovered = false;
let mouseIntersectPoint = new THREE.Vector3();
let targetIntersectPoint = new THREE.Vector3();
let lastIntersectPoint = new THREE.Vector3();
let isTransitioning = false;

// Mouse event listeners
function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(subcubes);
    const wasHovered = isHovered;
    isHovered = intersects.length > 0;
    
    if (isHovered && intersects[0]) {
        if (!wasHovered) {
            // Start of hover - initialize positions
            lastIntersectPoint.copy(intersects[0].point);
            mouseIntersectPoint.copy(intersects[0].point);
        }
        // Convert intersection point to local space
        targetIntersectPoint.copy(intersects[0].point);
        cubeGroup.worldToLocal(targetIntersectPoint);
        isTransitioning = true;
    }
}

window.addEventListener('mousemove', onMouseMove);

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation
let time = 0;
function animate() {
    requestAnimationFrame(animate);
    time += 0.01;

    // Smooth zoom interpolation
    cubeGroup.position.z = THREE.MathUtils.lerp(
        cubeGroup.position.z,
        targetZPosition,
        ZOOM_SMOOTHNESS
    );

    // Animate light positions - always behind camera
    const lightOffset = 20; // Distance behind camera
    light.position.z = camera.position.z + lightOffset;
    light2.position.z = camera.position.z + lightOffset + 15; // Slightly further back

    // First light movement - wide pattern but within scene bounds
    light.position.x = 
        Math.sin(time * 0.1) * 30 + // Reduced from 80
        Math.sin(time * 0.05) * 20 + // Reduced from 60
        Math.sin(time * 0.15) * 15 + // Reduced from 40
        Math.sin(time * 0.22) * 10 + // Reduced from 30
        Math.sin(time * 0.31) * 5;   // Reduced from 20
    light.position.y = 
        Math.cos(time * 0.08) * 25 + // Reduced from 70
        Math.cos(time * 0.04) * 20 + // Reduced from 50
        Math.cos(time * 0.12) * 15 + // Reduced from 35
        Math.cos(time * 0.19) * 10 + // Reduced from 25
        Math.cos(time * 0.27) * 5;   // Reduced from 15

    // Second light movement - different pattern, opposite direction
    light2.position.x = 
        -Math.sin(time * 0.17) * 35 + // Reduced from 100
        -Math.sin(time * 0.09) * 25 + // Reduced from 80
        -Math.sin(time * 0.25) * 20 + // Reduced from 60
        -Math.sin(time * 0.33) * 15 + // Reduced from 40
        -Math.sin(time * 0.41) * 10;  // Reduced from 30
    light2.position.y = 
        -Math.cos(time * 0.13) * 30 + // Reduced from 90
        -Math.cos(time * 0.07) * 25 + // Reduced from 70
        -Math.cos(time * 0.21) * 20 + // Reduced from 50
        -Math.cos(time * 0.29) * 15 + // Reduced from 35
        -Math.cos(time * 0.37) * 10;  // Reduced from 25

    // Smooth mouse intersection point movement
    if (isTransitioning) {
        mouseIntersectPoint.lerp(targetIntersectPoint, 0.1);
    }

    // Rotate entire cube group only when not hovered
    if (!isHovered) {
        cubeGroup.rotation.x += 0.001;
        cubeGroup.rotation.y += 0.002;
    }

    // Animate subcubes
    subcubes.forEach((cube) => {
        if (isHovered) {
            // Work in local space
            const localCubePos = cube.position.clone();
            
            // Calculate distance from cube to mouse intersection point in local space
            const distanceToMouse = localCubePos.distanceTo(mouseIntersectPoint);
            const explosionRadius = 7.2;
            
            // Calculate explosion strength based on distance
            const normalizedDistance = Math.max(0, 1 - (distanceToMouse / explosionRadius));
            const explodeStrength = 12.0 * Math.pow(normalizedDistance, 1.5);
            
            // Apply explosion only if within radius
            if (distanceToMouse < explosionRadius) {
                // Calculate direction from intersection point in local space
                const direction = localCubePos.sub(mouseIntersectPoint).normalize();
                const targetPosition = new THREE.Vector3(
                    cube.userData.originalPosition.x + direction.x * explodeStrength,
                    cube.userData.originalPosition.y + direction.y * explodeStrength,
                    cube.userData.originalPosition.z + direction.z * explodeStrength
                );
                
                // Smooth movement to target position
                cube.position.lerp(targetPosition, 0.15);
            } else {
                // Return to original position if outside explosion radius
                cube.position.lerp(cube.userData.originalPosition, 0.15);
            }
        } else {
            // Return to original position
            cube.position.lerp(cube.userData.originalPosition, 0.15);
        }
    });

    renderer.render(scene, camera);
}

animate(); 