import * as THREE from 'three';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Room setup (gradient background)
scene.background = new THREE.Color(0xf0f0f0);
const roomGeometry = new THREE.BoxGeometry(20, 20, 20);
const roomMaterial = new THREE.MeshStandardMaterial({
    side: THREE.BackSide,
    color: 0xe0e0e0,
    metalness: 0.1,
    roughness: 0.8
});
const room = new THREE.Mesh(roomGeometry, roomMaterial);
scene.add(room);

// Moving light setup
const light = new THREE.PointLight(0xffffff, 100);
light.position.set(0, 2, 5);
scene.add(light);

// Ambient light for better visibility
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// Create main cube composed of smaller cubes
const CUBE_SIZE = 2;
const SEGMENTS = 8;
const SUBCUBE_SIZE = CUBE_SIZE / SEGMENTS;
const cubeGroup = new THREE.Group();
const subcubes = [];

for (let x = 0; x < SEGMENTS; x++) {
    for (let y = 0; y < SEGMENTS; y++) {
        for (let z = 0; z < SEGMENTS; z++) {
            const geometry = new THREE.BoxGeometry(SUBCUBE_SIZE, SUBCUBE_SIZE, SUBCUBE_SIZE);
            const material = new THREE.MeshStandardMaterial({ 
                color: 0x444444,
                metalness: 0.5,
                roughness: 0.5
            });
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
camera.position.z = 8;

// Raycaster for mouse interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let isHovered = false;

// Mouse event listeners
function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(subcubes);
    isHovered = intersects.length > 0;
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

    // Animate light position
    light.position.x = Math.sin(time * 0.5) * 3;
    light.position.y = Math.cos(time * 0.3) * 2 + 2;
    light.position.z = Math.cos(time * 0.4) * 3 + 5;

    // Rotate entire cube group
    cubeGroup.rotation.x += 0.001;
    cubeGroup.rotation.y += 0.002;

    // Animate subcubes
    subcubes.forEach((cube) => {
        if (isHovered) {
            // Explode effect when hovered
            const explodeStrength = 0.5;
            cube.position.x = cube.userData.originalPosition.x + cube.userData.randomOffset.x * explodeStrength;
            cube.position.y = cube.userData.originalPosition.y + cube.userData.randomOffset.y * explodeStrength;
            cube.position.z = cube.userData.originalPosition.z + cube.userData.randomOffset.z * explodeStrength;
        } else {
            // Return to original position
            cube.position.lerp(cube.userData.originalPosition, 0.1);
        }
    });

    renderer.render(scene, camera);
}

animate(); 