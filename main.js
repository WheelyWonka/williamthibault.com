import * as THREE from 'three';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Room setup (gradient background)
scene.background = new THREE.Color(0xf0f0f0);
const roomGeometry = new THREE.BoxGeometry(140, 90, 100);
const roomMaterial = new THREE.MeshStandardMaterial({
    side: THREE.BackSide,
    color: 0x222222,
    metalness: 1,
    roughness: 0.5
});
const room = new THREE.Mesh(roomGeometry, roomMaterial);
scene.add(room);

// Moving light setup
const light = new THREE.PointLight(0xffffff, 20000);
// Generate random initial positions and movement parameters for first light
const light1Config = {
    basePos: {
        x: (Math.random() - 0.5) * 120,  // Random X between -60 and 60
        y: (Math.random() - 0.5) * 80,   // Random Y between -40 and 40
        z: (Math.random() - 0.5) * 40    // Random Z between -20 and 20
    },
    movement: {
        freqs: Array(5).fill(0).map(() => Math.random() * 0.2 + 0.05),  // Random frequencies between 0.05 and 0.25
        amps: Array(5).fill(0).map(() => Math.random() * 20 + 10),      // Random amplitudes between 10 and 30
        phases: Array(5).fill(0).map(() => Math.random() * Math.PI * 2)  // Random phase shifts
    }
};
light.position.set(light1Config.basePos.x, light1Config.basePos.y, light1Config.basePos.z);
scene.add(light);

// Second moving light
const light2 = new THREE.PointLight(0xffffff, 20000);
// Generate different random parameters for second light
const light2Config = {
    basePos: {
        x: (Math.random() - 0.5) * 120,  // Different random range
        y: (Math.random() - 0.5) * 80,
        z: Math.random() * 40 + 20       // Keep it behind first light
    },
    movement: {
        freqs: Array(5).fill(0).map(() => Math.random() * 0.2 + 0.05),  // Different random frequencies
        amps: Array(5).fill(0).map(() => Math.random() * 20 + 10),      // Different random amplitudes
        phases: Array(5).fill(0).map(() => Math.random() * Math.PI * 2)  // Different random phases
    }
};
light2.position.set(light2Config.basePos.x, light2Config.basePos.y, light2Config.basePos.z);
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

// Variables for the alive animation
const ALIVE_CHANCE = 0.0001; // Keep the same chance
const MAX_ACTIVE_CUBES = 30;  // Keep the same number of active cubes
let activeCubes = new Set(); // Track which cubes are currently "alive"

// Custom shader for concrete texture
const concreteShader = {
    uniforms: {
        time: { value: 0 },
        variation: { value: 0 },
        cubeSize: { value: CUBE_SIZE },
        mousePos: { value: new THREE.Vector2(0, 0) }  // Add mouse position uniform
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
        uniform float time;
        uniform float variation;
        uniform float cubeSize;
        uniform vec2 mousePos;  // Add mouse position uniform
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

        // Modified flow noise function to incorporate mouse influence
        vec2 flowNoise(vec2 st, float t) {
            // Base flow
            float angle1 = noise(st + t * 0.1) * 6.28318;
            float angle2 = noise(st * 1.5 - t * 0.15) * 6.28318;
            
            vec2 flow1 = vec2(cos(angle1), sin(angle1));
            vec2 flow2 = vec2(cos(angle2), sin(angle2));
            
            // Mouse influence
            vec2 mouseFlow = (mousePos - st) * 0.02; // Subtle mouse influence
            
            return flow1 * 0.3 + flow2 * 0.2 + mouseFlow;
        }

        float fbm(vec2 st) {
            float value = 0.0;
            float amplitude = 0.5;
            float frequency = 0.0;
            
            // Add flow-based movement to each octave
            vec2 flow = flowNoise(st * 0.5, time);
            
            for(int i = 0; i < 5; i++) {
                vec2 flowedSt = st + flow * (float(i) * 0.1);
                value += amplitude * noise(flowedSt);
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

            // Add time-based movement to the texture coordinates
            vec2 flow = flowNoise(st, time);
            st += flow * 0.2;
            
            // Pattern variations with movement
            float patterns[24] = float[24](
                n * 0.15 + fbm(st*2.0 + sin(time * 0.2) * 0.1) * 0.08,
                n * 0.12 + fbm(st*3.0 + cos(time * 0.15) * 0.1) * 0.1,
                n * 0.14 + fbm(st*2.5 + sin(time * 0.25) * 0.1) * 0.09,
                n * 0.16 + fbm(st*3.5 + cos(time * 0.18) * 0.1) * 0.07,
                n * 0.13 + fbm(st*4.0 + sin(time * 0.22) * 0.1) * 0.06,
                n * 0.17 + fbm(st*2.8 + cos(time * 0.2) * 0.1) * 0.08,
                n * 0.11 + fbm(st*3.2 + sin(time * 0.17) * 0.1) * 0.09,
                n * 0.15 + fbm(st*2.6 + cos(time * 0.23) * 0.1) * 0.07,
                n * 0.14 + fbm(st*3.8 + sin(time * 0.19) * 0.1) * 0.06,
                n * 0.16 + fbm(st*2.4 + cos(time * 0.21) * 0.1) * 0.08,
                n * 0.13 + fbm(st*3.4 + sin(time * 0.16) * 0.1) * 0.07,
                n * 0.15 + fbm(st*2.9 + cos(time * 0.24) * 0.1) * 0.09,
                n * 0.12 + fbm(st*3.6 + sin(time * 0.18) * 0.1) * 0.08,
                n * 0.16 + fbm(st*2.7 + cos(time * 0.22) * 0.1) * 0.07,
                n * 0.14 + fbm(st*3.3 + sin(time * 0.2) * 0.1) * 0.06,
                n * 0.13 + fbm(st*2.8 + cos(time * 0.17) * 0.1) * 0.08,
                n * 0.15 + fbm(st*3.7 + sin(time * 0.23) * 0.1) * 0.07,
                n * 0.12 + fbm(st*2.5 + cos(time * 0.19) * 0.1) * 0.09,
                n * 0.16 + fbm(st*3.1 + sin(time * 0.21) * 0.1) * 0.08,
                n * 0.14 + fbm(st*2.9 + cos(time * 0.18) * 0.1) * 0.07,
                n * 0.13 + fbm(st*3.5 + sin(time * 0.24) * 0.1) * 0.06,
                n * 0.15 + fbm(st*2.6 + cos(time * 0.2) * 0.1) * 0.08,
                n * 0.12 + fbm(st*3.2 + sin(time * 0.22) * 0.1) * 0.07,
                n * 0.16 + fbm(st*2.8 + cos(time * 0.17) * 0.1) * 0.09
            );
            
            // Imperfection strengths for each variation
            float imperfectionStrength[24] = float[24](
                0.15, 0.18, 0.14, 0.16, 0.13, 0.17,  // First set
                0.16, 0.14, 0.17, 0.15, 0.18, 0.13,  // Second set
                0.16, 0.15, 0.17, 0.14, 0.16, 0.18,  // Third set
                0.15, 0.17, 0.14, 0.16, 0.15, 0.17   // Fourth set
            );
            
            vec3 baseColor = colors[int(v)];
            float pattern = patterns[int(v)];
            
            vec3 color = baseColor + vec3(pattern - 0.075);
            color += vec3(imp * imperfectionStrength[int(v)]);
            
            return color;
        }

        void main() {
            // Use world position for seamless texturing with flow
            vec2 globalSt = vWorldPosition.xy / cubeSize * 8.0;
            vec2 flow = flowNoise(globalSt, time) * 0.3;
            globalSt += flow;
            
            float n = fbm(globalSt);
            float imp = fbm(globalSt * 4.0 + flow);
            
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
                Object.assign(shader.uniforms, {
                    time: { value: 0 },
                    variation: { value: Math.floor(Math.random() * 24) },
                    cubeSize: { value: CUBE_SIZE },
                    mousePos: { value: new THREE.Vector2(0, 0) }
                });
                
                // Store shader reference for updates
                material.userData.shader = shader;

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

                // Extract all function declarations from concrete shader
                const functionDeclarations = `
                    uniform float time;
                    uniform float variation;
                    uniform float cubeSize;
                    uniform vec2 mousePos;
                    varying vec3 vWorldPosition;

                    // Arrays for colors and patterns
                    vec3 colors[24] = vec3[24](
                        vec3(0.067), vec3(0.045), vec3(0.058), vec3(0.042),
                        vec3(0.049), vec3(0.054), vec3(0.061), vec3(0.043),
                        vec3(0.056), vec3(0.040), vec3(0.047), vec3(0.055),
                        vec3(0.063), vec3(0.039), vec3(0.048), vec3(0.052),
                        vec3(0.046), vec3(0.041), vec3(0.050), vec3(0.044),
                        vec3(0.057), vec3(0.038), vec3(0.052), vec3(0.053)
                    );

                    float imperfectionStrength[24] = float[24](
                        0.15, 0.18, 0.14, 0.16, 0.13, 0.17,
                        0.16, 0.14, 0.17, 0.15, 0.18, 0.13,
                        0.16, 0.15, 0.17, 0.14, 0.16, 0.18,
                        0.15, 0.17, 0.14, 0.16, 0.15, 0.17
                    );

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
                        return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
                    }

                    vec2 flowNoise(vec2 st, float t) {
                        float angle1 = noise(st + t * 0.1) * 6.28318;
                        float angle2 = noise(st * 1.5 - t * 0.15) * 6.28318;
                        vec2 flow1 = vec2(cos(angle1), sin(angle1));
                        vec2 flow2 = vec2(cos(angle2), sin(angle2));
                        vec2 mouseFlow = (mousePos - st) * 0.02;
                        return flow1 * 0.3 + flow2 * 0.2 + mouseFlow;
                    }

                    float fbm(vec2 st) {
                        float value = 0.0;
                        float amplitude = 0.5;
                        vec2 flow = flowNoise(st * 0.5, time);
                        for(int i = 0; i < 5; i++) {
                            vec2 flowedSt = st + flow * (float(i) * 0.1);
                            value += amplitude * noise(flowedSt);
                            st *= 2.0;
                            amplitude *= 0.5;
                        }
                        return value;
                    }

                    vec3 getVariationColor(float v, vec2 st, float n, float imp) {
                        vec2 flow = flowNoise(st, time);
                        st += flow * 0.2;
                        
                        float pattern = n * 0.15 + fbm(st*2.0 + sin(time * 0.2) * 0.1) * 0.08;
                        vec3 baseColor = colors[int(v)];
                        vec3 color = baseColor + vec3(pattern - 0.075);
                        color += vec3(imp * imperfectionStrength[int(v)]);
                        return color;
                    }
                `;

                // Add all declarations and functions to fragment shader
                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <common>',
                    '#include <common>\n' + functionDeclarations
                );

                // Replace the color calculation
                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <color_fragment>',
                    `
                    #include <color_fragment>
                    vec2 globalSt = vWorldPosition.xy / cubeSize * 8.0;
                    vec2 flow = flowNoise(globalSt, time) * 0.3;
                    globalSt += flow;
                    float n = fbm(globalSt);
                    float imp = fbm(globalSt * 4.0 + flow);
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
            
            // Add alive animation properties
            cube.userData.isAlive = false;
            cube.userData.aliveTime = 0;
            cube.userData.aliveDuration = 0;
            cube.userData.aliveDirection = new THREE.Vector3();
            
            // Determine which face this cube belongs to
            if (x === 0 || x === SEGMENTS - 1) {
                // On X face (left or right)
                cube.userData.isFaceCube = true;
                cube.userData.faceNormal = new THREE.Vector3(x === 0 ? -1 : 1, 0, 0);
            } else if (y === 0 || y === SEGMENTS - 1) {
                // On Y face (top or bottom)
                cube.userData.isFaceCube = true;
                cube.userData.faceNormal = new THREE.Vector3(0, y === 0 ? -1 : 1, 0);
            } else if (z === 0 || z === SEGMENTS - 1) {
                // On Z face (front or back)
                cube.userData.isFaceCube = true;
                cube.userData.faceNormal = new THREE.Vector3(0, 0, z === 0 ? -1 : 1);
            } else {
                cube.userData.isFaceCube = false;
            }

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
    // Update normalized mouse coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update shader uniform for all subcubes
    subcubes.forEach((cube) => {
        if (cube.material.userData.shader) {
            cube.material.userData.shader.uniforms.mousePos.value.set(mouse.x, mouse.y);
        }
    });
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(subcubes);
    const wasHovered = isHovered;
    isHovered = intersects.length > 0;
    
    if (isHovered && intersects[0]) {
        if (!wasHovered) {
            lastIntersectPoint.copy(intersects[0].point);
            mouseIntersectPoint.copy(intersects[0].point);
        }
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

    // Animate light positions with random patterns
    const lightOffset = 20;
    
    // First light movement using random parameters
    light.position.x = light1Config.basePos.x;
    light.position.y = light1Config.basePos.y;
    for (let i = 0; i < 5; i++) {
        light.position.x += Math.sin(time * light1Config.movement.freqs[i] + light1Config.movement.phases[i]) * light1Config.movement.amps[i];
        light.position.y += Math.cos(time * light1Config.movement.freqs[i] + light1Config.movement.phases[i]) * light1Config.movement.amps[i];
    }
    light.position.z = camera.position.z + lightOffset;

    // Second light movement using different random parameters
    light2.position.x = light2Config.basePos.x;
    light2.position.y = light2Config.basePos.y;
    for (let i = 0; i < 5; i++) {
        light2.position.x += Math.sin(time * light2Config.movement.freqs[i] + light2Config.movement.phases[i]) * light2Config.movement.amps[i];
        light2.position.y += Math.cos(time * light2Config.movement.freqs[i] + light2Config.movement.phases[i]) * light2Config.movement.amps[i];
    }
    light2.position.z = camera.position.z + lightOffset + 15;

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
            // Existing hover explosion logic
            const localCubePos = cube.position.clone();
            const distanceToMouse = localCubePos.distanceTo(mouseIntersectPoint);
            const explosionRadius = 7.2;
            
            const normalizedDistance = Math.max(0, 1 - (distanceToMouse / explosionRadius));
            const explodeStrength = 12.0 * Math.pow(normalizedDistance, 1.5);
            
            if (distanceToMouse < explosionRadius) {
                const direction = localCubePos.sub(mouseIntersectPoint).normalize();
                const targetPosition = new THREE.Vector3(
                    cube.userData.originalPosition.x + direction.x * explodeStrength,
                    cube.userData.originalPosition.y + direction.y * explodeStrength,
                    cube.userData.originalPosition.z + direction.z * explodeStrength
                );
                
                cube.position.lerp(targetPosition, 0.15);
                
                // Reset alive state when hovered
                cube.userData.isAlive = false;
                activeCubes.delete(cube);
            } else {
                cube.position.lerp(cube.userData.originalPosition, 0.15);
            }
        } else {
            // Handle "alive" animation
            if (cube.userData.isAlive) {
                cube.userData.aliveTime += 0.016; // Approximate for 60fps
                
                // Calculate movement using a multi-phase animation curve
                const progress = cube.userData.aliveTime / cube.userData.aliveDuration;
                let movementCurve;
                
                if (progress < 0.2) {
                    // Quick push out (0-20% of duration) - use custom escape speed
                    movementCurve = progress * (5.0 * cube.userData.escapeSpeed);
                } else if (progress < 0.7) {
                    // Hold and struggle (20-70% of duration) - use custom struggle intensity
                    const strugglePhase = (progress - 0.15) * 20.0;
                    movementCurve = 1.0 + Math.sin(strugglePhase) * cube.userData.struggleIntensity;
                } else {
                    // Give up and return (70-100% of duration)
                    const returnPhase = (progress - 0.7) / 0.3;
                    movementCurve = 1.0 * (1.0 - Math.pow(returnPhase, 2));
                }
                
                const moveAmount = movementCurve * cube.userData.escapeDistance; // Use random escape distance
                
                const targetPosition = new THREE.Vector3(
                    cube.userData.originalPosition.x + cube.userData.faceNormal.x * moveAmount,
                    cube.userData.originalPosition.y + cube.userData.faceNormal.y * moveAmount,
                    cube.userData.originalPosition.z + cube.userData.faceNormal.z * moveAmount
                );
                
                // Adjust lerp speed based on phase and escape speed
                const lerpSpeed = progress < 0.2 ? cube.userData.escapeSpeed : // Fast during push out
                                progress < 0.7 ? 0.3 : // Medium during hold
                                0.2;                    // Slower during return
                
                cube.position.lerp(targetPosition, lerpSpeed);
                
                // End animation if duration is reached
                if (cube.userData.aliveTime >= cube.userData.aliveDuration) {
                    cube.userData.isAlive = false;
                    activeCubes.delete(cube);
                }
            } else {
                // Return to original position if not alive
                cube.position.lerp(cube.userData.originalPosition, 0.2);
            }

            if (!cube.userData.isAlive && cube.userData.isFaceCube && activeCubes.size < MAX_ACTIVE_CUBES && Math.random() < ALIVE_CHANCE) {
                cube.userData.isAlive = true;
                cube.userData.aliveTime = 0;
                cube.userData.aliveDuration = Math.random() * 0.5 + 1.2; // 1.2-1.7 seconds
                // Add random speeds, intensities, and distances for this attempt
                cube.userData.escapeSpeed = Math.random() * 0.4 + 0.3; // Random speed between 0.3 and 0.7
                cube.userData.struggleIntensity = Math.random() * 0.04 + 0.01; // Random wobble between 0.01 and 0.05
                cube.userData.escapeDistance = Math.random() * 0.9 + 0.1; // Random distance between 1.0 and 2.0
                activeCubes.add(cube);
            }
        }
    });

    // Update time uniform for all subcubes
    subcubes.forEach((cube) => {
        if (cube.material.userData.shader) {
            cube.material.userData.shader.uniforms.time.value = time;
        }
    });

    renderer.render(scene, camera);
}

animate(); 