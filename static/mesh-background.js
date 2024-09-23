import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.157.0/+esm';

export { initMeshBackground, renderBackground, renderAndReturnUrlOfCopy };

const MAX_DIVS = 100;
let ACTIVE_DIVS = 3;

const globalRenderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('canvas#mesh-background'),
});

function extractValuesFromDOM(rootDoc) {

    const container = rootDoc.querySelector(".zoomable");
    const divs = rootDoc.querySelectorAll(".group");

    const containerLeft = container.offsetLeft;
    const containerTop = container.offsetTop;

    const canvasWidth = container.offsetWidth;
    const canvasHeight = container.offsetHeight;

    console.log("[MESH BACKGROUND] recalculating size ", canvasWidth, canvasHeight);

    const divData = [...divs].map((div) => {

        const relativeLeft = div.offsetLeft - containerLeft + div.offsetWidth / 2;
        const relativeTop = div.offsetTop - containerTop + div.offsetHeight / 2;
        const width = div.offsetWidth;
        const height = div.offsetHeight;

        const colorStyle = getComputedStyle(div, null).borderColor;
        const colorNumberPattern = /([\.\d]+)/g;

        let color = colorStyle.match(colorNumberPattern).slice(0, 3).map(parseFloat);

        // Normalize color channels
        color = color.map(channel => channel / 255.0);

        return {
            position: new THREE.Vector2(relativeLeft / canvasWidth, 1 - (relativeTop / canvasHeight)),
            width: width,
            height: height,
            color: new THREE.Vector3(color[0], color[1], color[2])
        };
    });

    return {
        divData,
        containerSize: { width: canvasWidth, height: canvasHeight },
        activeDivCount: divs.length
    };
}

function initMeshBackground(rootDoc, renderer = globalRenderer) {

    const canvasWidth = 1024;
    const canvasHeight = 1024;

    let uniforms = {

        divPositions: { value: new Array(MAX_DIVS).fill().map(() => new THREE.Vector2(0.0, 0.0)) },
        divWidth: { value: new Array(MAX_DIVS).fill().map(() => 0.5) },
        divHeight: { value: new Array(MAX_DIVS).fill().map(() => 0.5) },
        divColors: { value: new Array(MAX_DIVS).fill().map(() => new THREE.Vector3(1.0, 0.0, 0.0)) },

        // multiply the normalized [0, 1] size of the ellipse
        shapeExpansion: { value: 1.7 },

        activeDivCount: { value: ACTIVE_DIVS },

        resolution: { value: new THREE.Vector2(canvasWidth, canvasHeight) },

        backgroundColor: { value: new THREE.Vector3(.97, .95, .90) },

    };

    const SHADER_MATERIAL = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: `
        void main() {
            gl_Position = vec4(position.xy, 0.0, 1.0);
        }`,

        fragmentShader: `
        #define MAX_DIVS ${MAX_DIVS}
        #define TAU 6.28318530718
        #define SRGB_EPSILON 1e-5

        precision mediump float;
    
        uniform vec2 divPositions[MAX_DIVS];
        uniform vec3 divColors[MAX_DIVS];
        uniform float divWidth[MAX_DIVS];
        uniform float divHeight[MAX_DIVS];
        uniform int activeDivCount;
        uniform vec2 resolution;
        uniform float shapeExpansion;
        uniform vec3 backgroundColor;
            
        mat3 m1=mat3(
            .4122214708,.5363325363,.0514459929,
            .2119034982,.6806995451,.1073969566,
            .0883024619,.2817188376,.6299787005
        );

        mat3 inverse_m1=mat3(
            4.0767416621,-3.3077115913,.2309699292,
            -1.2684380046,2.6097574011,-.3413193965,
            -.0041960863,-.7034186147,1.7076147010
        );

        mat3 m2=mat3(
            .2104542553,.7936177850,-.0040720468,
            1.9779984951,-2.4285922050,.4505937099,
            .0259040371,.7827717662,-.8086757660
        );

        mat3 inverse_m2=mat3(
            1.,.3963377774,.2158037573,
            1.,-.1055613458,-.0638541728,
            1.,-.0894841775,-1.2914855480
        );

        float cbrt(float x){
            return sign(x)*pow(abs(x),1./3.);
        }

        vec3 cbrt(vec3 xyz){
            return vec3(cbrt(xyz.x),cbrt(xyz.y),cbrt(xyz.z));
        }

        float srgb2rgb(const in float v){
            return(v<.04045)?v*.0773993808:pow((v+.055)*.947867298578199,2.4);
        }

        vec3 srgb2rgb(const in vec3 srgb){
            return vec3(srgb2rgb(srgb.r+SRGB_EPSILON),srgb2rgb(srgb.g+SRGB_EPSILON),srgb2rgb(srgb.b+SRGB_EPSILON));
        }

        float rgb2srgb(const in float c){
            return(c<.0031308)?c*12.92:1.055*pow(c,.4166666666666667)-.055;
        }

        vec3 rgb2srgb(const in vec3 rgb){
            return clamp(vec3(rgb2srgb(rgb.r-SRGB_EPSILON),rgb2srgb(rgb.g-SRGB_EPSILON),rgb2srgb(rgb.b-SRGB_EPSILON)),0.,1.);
        }

        vec3 rgb2oklab(vec3 rgb){
            return cbrt(rgb*m1)*m2;
        }

        vec3 oklab2rgb(vec3 oklab){
            return pow(oklab*inverse_m2,vec3(3.))*inverse_m1;
        }

        void main(){
            
            vec2 uv=gl_FragCoord.xy/resolution;
            
            float aspectRatio=resolution.x/resolution.y;
            uv.x*=aspectRatio;// Correct for the aspect ratio
            
            // Start with a white background color in OKLAB space
            vec3 accumulatedColorOKLAB=rgb2oklab(backgroundColor);
            float accumulatedAlpha=1.;
            
            // Start with a weight of 1 for the white background
            float totalWeight=1.;
            
            for(int i=0;i<MAX_DIVS;i++){
                if(i>=activeDivCount)break;
                
                vec2 correctedPosition=divPositions[i];
                correctedPosition.x*=aspectRatio;
                
                float ellipseWidth=(divWidth[i]/resolution.x)*shapeExpansion;
                float ellipseHeight=(divHeight[i]/resolution.y)*shapeExpansion;
                
                vec2 ellipseRadius=vec2(ellipseWidth,ellipseHeight)*.5;
                vec2 dist=(uv-correctedPosition)/ellipseRadius;
                
                float distance=length(dist);
                
                if(distance>1.)continue;
                
                // Adjust influence computation for a softer fade
                float influence=clamp((1.-distance)/.9,0.,1.);
                
                vec3 colorOKLAB=rgb2oklab(srgb2rgb(divColors[i]));
                
                // Interpolate the color in OKLAB space
                accumulatedColorOKLAB=mix(accumulatedColorOKLAB,colorOKLAB,influence);
                
                accumulatedAlpha=mix(accumulatedAlpha,.8,influence);
                
                totalWeight=mix(totalWeight,1.,influence);
            }
            
            vec3 accumulatedColorRGB=rgb2srgb(oklab2rgb(accumulatedColorOKLAB));
            
            gl_FragColor=vec4(accumulatedColorRGB,accumulatedAlpha);
        }
        `
    });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, canvasWidth / canvasHeight, 0.1, 1000);

    const planeGeometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(planeGeometry, SHADER_MATERIAL);
    scene.add(mesh);

    if (rootDoc === document) {


        window.addEventListener('resize', () => {
            renderBackground({
                rootDoc: rootDoc,
                renderer: renderer,
                scene: scene,
                camera: camera,
                shaderMaterial: SHADER_MATERIAL,
            });
        });

        document.addEventListener("group-element-resized", () => {

            renderBackground({
                rootDoc: rootDoc,
                renderer: renderer,
                scene: scene,
                camera: camera,
                shaderMaterial: SHADER_MATERIAL,
            });
        });

        document.addEventListener("group-element-added-or-removed", () => {

            renderBackground({
                rootDoc: rootDoc,
                renderer: renderer,
                scene: scene,
                camera: camera,
                shaderMaterial: SHADER_MATERIAL,
            });
        });

    }

    renderBackground({
        rootDoc: rootDoc,
        renderer: renderer,
        scene: scene,
        camera: camera,
        shaderMaterial: SHADER_MATERIAL,
    });

}

function renderBackground({ rootDoc, renderer = globalRenderer, scene, camera, shaderMaterial }) {

    const { divData, containerSize, activeDivCount } = extractValuesFromDOM(rootDoc);

    const canvasWidth = containerSize.width;
    const canvasHeight = containerSize.height;
    const activeDivs = activeDivCount;

    camera.aspect = canvasWidth / canvasHeight;
    camera.position.z = 5;
    camera.updateProjectionMatrix();

    renderer.setSize(canvasWidth, canvasHeight);

    shaderMaterial.uniforms.resolution.value.set(canvasWidth, canvasHeight);

    if (activeDivs > 0) {

        // Update uniforms with extracted div data
        divData.forEach((div, index) => {
            shaderMaterial.uniforms.divPositions.value[index].copy(div.position);
            shaderMaterial.uniforms.divWidth.value[index] = div.width;
            shaderMaterial.uniforms.divHeight.value[index] = div.height;
            shaderMaterial.uniforms.divColors.value[index].copy(div.color);
        });

    }
    else {
        shaderMaterial.uniforms.divPositions.value[0] = new THREE.Vector2(0.0, 0.0);
        shaderMaterial.uniforms.divWidth.value[0] = 0;
        shaderMaterial.uniforms.divHeight.value[0] = 0;
        shaderMaterial.uniforms.divColors.value[0] = new THREE.Vector3(0.0, 0.0, 0.0);
    }

    shaderMaterial.uniforms.activeDivCount.value = activeDivs;

    renderer.render(scene, camera);
}

async function renderAndReturnUrlOfCopy(rootDoc) {

    // Initialize a new renderer for offscreen rendering

    const canvas = document.createElement('canvas');

    const temporaryRenderer = new THREE.WebGLRenderer({
        canvas: canvas,
    });

    // Set up the offscreen rendering environment
    // and Render the scene offscreen
    initMeshBackground(rootDoc, temporaryRenderer);

    // Create a temporary canvas to apply the blur effect
    const blurredCanvas = document.createElement('canvas');
    blurredCanvas.width = canvas.width;
    blurredCanvas.height = canvas.height;
    const tempCtx = blurredCanvas.getContext('2d');

    // Draw the original content onto the temporary canvas
    // tempCtx.drawImage(canvas, 0, 0);

    // Apply the blur effect. Safari just ignore it.
    // const vw = Math.max(rootDoc.documentElement.clientWidth || 0, window.innerWidth || 0);
    // const blurRadius = 0.03 * vw;
    // tempCtx.filter = `blur(${blurRadius}px)`;

    // tempCtx.drawImage(blurredCanvas, 0, 0);

    const dataURI = canvas.toDataURL('image/jpeg', 0.9);

    temporaryRenderer.dispose();

    return { dataURI };
}