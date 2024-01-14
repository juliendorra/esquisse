import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.157.0/+esm';

export { initMeshBackground, renderBackground, renderAndReturnUrlOfCopy };

const MAX_DIVS = 100;
let ACTIVE_DIVS = 3;

let CANVASWIDTH;
let CANVASHEIGHT;

const SCENE = new THREE.Scene();
const CAMERA = new THREE.PerspectiveCamera(75, CANVASWIDTH / CANVASHEIGHT, 0.1, 1000);

const RENDERER = new THREE.WebGLRenderer(
    {
        canvas: document.querySelector('canvas#mesh-background')
    });

RENDERER.setSize(CANVASWIDTH, CANVASHEIGHT);

CAMERA.position.z = 5;

let SHADER_MATERIAL;


function initMeshBackground() {

    const container = document.querySelector('.container');

    CANVASWIDTH = container.scrollWidth;
    CANVASHEIGHT = container.scrollHeight;

    const divs = document.querySelectorAll(".group");

    ACTIVE_DIVS = divs.length;

    let uniforms = {
        divPositions: {
            value: new Array(MAX_DIVS).fill().map(() => new THREE.Vector2(0.0, 0.0))
        },

        divWidth: {
            value: new Array(MAX_DIVS).fill().map(() => 0.5),
        },

        divHeight: {
            value: new Array(MAX_DIVS).fill().map(() => 0.5),
        },

        divColors: {
            value: new Array(MAX_DIVS).fill().map(() => new THREE.Vector3(1.0, 0.0, 0.0))
        },

        circleExpansion: { value: 0.05 },

        activeDivCount: { value: ACTIVE_DIVS },

        resolution: { value: new THREE.Vector2(CANVASWIDTH, CANVASHEIGHT) },

    };

    SHADER_MATERIAL = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: `
        void main() {
            gl_Position = vec4(position.xy, 0.0, 1.0);
        }`,

        fragmentShader: `

        #define MAX_DIVS 100

        precision mediump float;

        uniform vec2 divPositions[MAX_DIVS];
        uniform vec3 divColors[MAX_DIVS];
        uniform float divWidth[MAX_DIVS];
        uniform float divHeight[MAX_DIVS];
        uniform int activeDivCount;
        uniform vec2 resolution;
        uniform float circleExpansion; 

        vec4 gradient(vec4 bgColor, vec4 fgColor, float interpolator){
            return vec4(mix(bgColor, fgColor, interpolator));
        }

        void main(){
            vec2 uv = gl_FragCoord.xy / resolution;

            float aspectRatio = resolution.x / resolution.y;
            uv.x *= aspectRatio; // Correct for the aspect ratio

            vec4 accumulatedColor = vec4(1.0);  // Start with a white background color
            float totalWeight = 1.0; // Start with a weight of 1 for the white background

            for(int i = 0; i < MAX_DIVS; i++){
                if(i >= activeDivCount) break;

                vec2 correctedPosition = divPositions[i];
                correctedPosition.x *= aspectRatio;

                // Get the maximum dimension for this circle and convert it to normalized value
                float maxDimension = max(divWidth[i], divHeight[i]) + circleExpansion;
                float normalizedCircleSize = maxDimension / resolution.y; 

                float distance = distance(uv, correctedPosition);

                if (distance > normalizedCircleSize) continue;

                // Adjust influence computation for a softer fade
                float influence = clamp((normalizedCircleSize - distance) / (0.5 * normalizedCircleSize), 0.0, 1.0);

                // Accumulate the weighted color
                accumulatedColor += vec4(divColors[i], 1.0) * influence;
                totalWeight += influence;
            }

            // Normalize the accumulated color
            if(totalWeight > 0.0) {
                accumulatedColor /= totalWeight;
            }

            gl_FragColor = accumulatedColor;
        }
    
        `
    });

    const planeGeometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(planeGeometry, SHADER_MATERIAL);

    SCENE.add(mesh);

    renderBackground();

    window.addEventListener('resize', () => {

        renderBackground();

    });

}

function renderBackground() {

    const container = document.querySelector('.container');

    CANVASWIDTH = container.scrollWidth;
    CANVASHEIGHT = container.scrollHeight;

    RENDERER.setSize(CANVASWIDTH, CANVASHEIGHT);
    CAMERA.aspect = CANVASWIDTH / CANVASHEIGHT;
    CAMERA.updateProjectionMatrix();

    SHADER_MATERIAL.uniforms.resolution.value.set(CANVASWIDTH, CANVASHEIGHT);

    // console.log("[Mesh Background] Ratio: ", CANVASWIDTH / CANVASHEIGHT)

    const divs = document.querySelectorAll(".group");

    const containerLeft = container.offsetLeft;
    const containerTop = container.offsetTop;

    ACTIVE_DIVS = divs.length;

    divs.forEach((div, index) => {

        // Calculate relative position of the div to the .container using offsetLeft and offsetTop
        const relativeLeft = div.offsetLeft - containerLeft + div.offsetWidth / 2;
        const relativeTop = div.offsetTop - containerTop + div.offsetHeight / 2;

        SHADER_MATERIAL.uniforms.divPositions.value[index].set(
            relativeLeft / container.offsetWidth,
            1 - (relativeTop / container.offsetHeight)
        );

        const width = div.scrollWidth;
        const height = div.scrollHeight;

        SHADER_MATERIAL.uniforms.divWidth.value[index] = width;
        SHADER_MATERIAL.uniforms.divHeight.value[index] = height;

        const color = getComputedStyle(div).borderColor.split('(')[1].split(')')[0].split(',');

        SHADER_MATERIAL.uniforms.divColors.value[index].set(
            parseFloat(color[0]) / 255.0,
            parseFloat(color[1]) / 255.0,
            parseFloat(color[2]) / 255.0
        );

    });

    SHADER_MATERIAL.uniforms.activeDivCount.value = divs.length;

    RENDERER.render(SCENE, CAMERA);
}


async function renderAndReturnUrlOfCopy() {

    renderBackground();

    // Convert 3vw to pixels
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const blurRadius = 0.03 * vw; // 3% of the viewport width

    // Create a temporary canvas to apply the blur effect
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = RENDERER.domElement.width;
    tempCanvas.height = RENDERER.domElement.height;
    const tempCtx = tempCanvas.getContext('2d');

    // Draw the original canvas content onto the temporary canvas
    tempCtx.drawImage(RENDERER.domElement, 0, 0);

    // Apply the blur effect. Safari just ignore it.
    tempCtx.filter = `blur(${blurRadius}px)`;
    tempCtx.drawImage(tempCanvas, 0, 0);

    // Save the blurred canvas as a Blob URL
    const blob = await canvasToBlob(tempCanvas);
    const blobUrl = URL.createObjectURL(blob);
    return blobUrl;
}

// utils 
function canvasToBlob(canvas) {
    return new Promise(function (resolve) {
        canvas.toBlob(
            resolve,
            'image/jpeg',
            0.9
        );
    });
};