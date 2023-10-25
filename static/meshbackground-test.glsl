#define MAX_DIVS 100

precision mediump float;

uniform vec2 u_resolution;
vec2 divPositions[MAX_DIVS];
vec3 divColors[MAX_DIVS];
float divWidth[MAX_DIVS];
float divHeight[MAX_DIVS];
int activeDivCount;
float circleExpansion;

// https://github.com/Experience-Monks/glsl-hsl2rgb/blob/master/index.glsl
float hue2rgb(float f1,float f2,float hue){
    if(hue<0.)
    hue+=1.;
    else if(hue>1.)
    hue-=1.;
    float res;
    if((6.*hue)<1.)
    res=f1+(f2-f1)*6.*hue;
    else if((2.*hue)<1.)
    res=f2;
    else if((3.*hue)<2.)
    res=f1+(f2-f1)*((2./3.)-hue)*6.;
    else
    res=f1;
    return res;
}

vec3 hsl2rgb(vec3 hsl){
    vec3 rgb;
    
    if(hsl.y==0.){
        rgb=vec3(hsl.z);// Luminance
    }else{
        float f2;
        
        if(hsl.z<.5)
        f2=hsl.z*(1.+hsl.y);
        else
        f2=hsl.z+hsl.y-hsl.y*hsl.z;
        
        float f1=2.*hsl.z-f2;
        
        rgb.r=hue2rgb(f1,f2,hsl.x+(1./3.));
        rgb.g=hue2rgb(f1,f2,hsl.x);
        rgb.b=hue2rgb(f1,f2,hsl.x-(1./3.));
    }
    return rgb;
}

// https://www.shadertoy.com/view/lsS3Wc
vec3 rgb2hsl(vec3 col){
    const float eps=.0000001;
    
    float minc=min(col.r,min(col.g,col.b));
    float maxc=max(col.r,max(col.g,col.b));
    vec3 mask=step(col.grr,col.rgb)*step(col.bbg,col.rgb);
    vec3 h=mask*(vec3(0.,2.,4.)+(col.gbr-col.brg)/(maxc-minc+eps))/6.;
    mask*=1.-mask.gbr;
    return vec3(fract(1.+h.x+h.y+h.z),// H
    (maxc-minc)/(1.-abs(minc+maxc-1.)+eps),// S
    (minc+maxc)*.5);// L
}

void main(){
    
    vec2 resolution=u_resolution;
    
    divPositions[0]=vec2(.5,.5);
    divColors[0]=vec3(1.,.0,.0);
    divWidth[0]=.2;
    divHeight[0]=.2;
    activeDivCount=1;
    circleExpansion=0.;
    
    vec2 uv=gl_FragCoord.xy/resolution;
    
    float aspectRatio=resolution.x/resolution.y;
    uv.x*=aspectRatio;// Correct for the aspect ratio
    
    vec4 accumulatedColor=vec4(1.);// Start with a white background color
    float totalWeight=1.;// Start with a weight of 1 for the white background
    
    for(int i=0;i<MAX_DIVS;i++){
        if(i>=activeDivCount)break;
        
        vec2 correctedPosition=divPositions[i];
        correctedPosition.x*=aspectRatio;
        
        // Get the maximum dimension for this circle and convert it to normalized value
        float maxDimension=max(divWidth[i],divHeight[i])+circleExpansion;
        float normalizedCircleSize=maxDimension/resolution.y;
        
        float distance=distance(uv,correctedPosition);
        
        if(distance>normalizedCircleSize)continue;
        
        // Adjust influence computation for a softer fade
        float influence=clamp((normalizedCircleSize-distance)/(.5*normalizedCircleSize),0.,1.);
        
        // Accumulate the weighted color
        accumulatedColor+=vec4(divColors[i],1.)*influence;
        totalWeight+=influence;
    }
    
    // Normalize the accumulated color
    if(totalWeight>0.){
        accumulatedColor/=totalWeight;
    }
    
    gl_FragColor=accumulatedColor;
}