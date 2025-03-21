import * as THREE from 'three';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Custom shader for concrete texture
const concreteShader = {
    uniforms: {
        time: { value: 0 },
        variation: { value: 0 }
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;

        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float variation;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;

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
            // Base colors for each variation
            vec3 colors[6] = vec3[6](
                vec3(0.267, 0.267, 0.267),  // Classic grey
                vec3(0.25, 0.23, 0.21),     // Brownish
                vec3(0.28, 0.28, 0.30),     // Bluish grey
                vec3(0.22, 0.24, 0.23),     // Greenish
                vec3(0.29, 0.27, 0.25),     // Warm grey
                vec3(0.24, 0.25, 0.27)      // Cool grey
            );

            // Pattern variations
            float patterns[6] = float[6](
                n * 0.15,                    // Standard noise
                n * 0.2 + sin(st.x*10.0) * 0.05,  // Striated
                n * 0.12 + fbm(st*2.0) * 0.08,    // Double noise
                n * 0.18 + cos(st.y*8.0) * 0.04,  // Horizontal lines
                n * 0.15 + sin(st.x*6.0 + st.y*6.0) * 0.06, // Diagonal pattern
                n * 0.1 + fbm(st*3.0) * 0.1       // Heavy noise
            );

            vec3 baseColor = colors[int(v)];
            float pattern = patterns[int(v)];
            
            // Add variation-specific imperfections
            float imperfectionStrength[6] = float[6](
                0.1, 0.15, 0.08, 0.12, 0.14, 0.11
            );
            
            vec3 color = baseColor + vec3(pattern - 0.075);
            color += vec3(imp * imperfectionStrength[int(v)]);
            
            return color;
        }

        void main() {
            // Create base concrete texture
            vec2 st = vUv * 8.0; // Scale UV for more detail
            float n = fbm(st);
            float imp = fbm(st * 4.0);
            
            // Get color based on variation
            vec3 color = getVariationColor(variation, st, n, imp);
            
            // Add edge darkening
            float edgeEffect = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 0.5) * 0.3;
            color = mix(color, color * 0.8, edgeEffect);

            gl_FragColor = vec4(color, 1.0);
        }
    `
};

// Room setup (gradient background)
scene.background = new THREE.Color(0xf0f0f0);
const roomGeometry = new THREE.BoxGeometry(70, 70, 100);
const roomMaterial = new THREE.MeshStandardMaterial({
    side: THREE.BackSide,
    color: 0x333333,
    metalness: 0.1,
    roughness: 0.8
});
const room = new THREE.Mesh(roomGeometry, roomMaterial);
scene.add(room);

// Moving light setup
const light = new THREE.PointLight(0xffffff, 5000);
light.position.set(0, 2, 5);
scene.add(light);

// Ambient light for better visibility
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// Create main cube composed of smaller cubes
const CUBE_SIZE = 12;
const SEGMENTS = 8;
const SUBCUBE_SIZE = CUBE_SIZE / SEGMENTS;
const cubeGroup = new THREE.Group();
const subcubes = [];

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
                shader.uniforms.variation = { value: Math.floor(Math.random() * 6) };
                
                // Add our custom functions before main
                const customFunctions = concreteShader.fragmentShader
                    .split('void main() {')[0]
                    .replace(/uniform float variation;[\s\S]*?varying vec3 vPosition;/, '');
                
                shader.fragmentShader = shader.fragmentShader.replace(
                    'void main() {',
                    `
                    uniform float variation;
                    ${customFunctions}
                    void main() {
                    `
                );

                // Replace the color calculation
                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <color_fragment>',
                    `
                    #include <color_fragment>
                    #if defined( USE_UV )
                        vec2 st = vUv.xy * 8.0;
                        float n = fbm(st);
                        float imp = fbm(st * 4.0);
                        vec3 concreteColor = getVariationColor(variation, st, n, imp);
                        
                        float edgeEffect = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 0.5) * 0.3;
                        concreteColor = mix(concreteColor, concreteColor * 0.8, edgeEffect);
                        
                        diffuseColor.rgb *= concreteColor;
                    #endif
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

    // Animate light position - always behind camera
    const lightOffset = 5; // Distance behind camera
    light.position.z = camera.position.z + lightOffset;
    light.position.x = Math.sin(time * 0.5) * 4;
    light.position.y = Math.cos(time * 0.3) * 3 + 2;

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