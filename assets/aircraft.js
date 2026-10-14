// A persistent textured airframe, projected with a rigid rotation about its nose-tail axis.
// UVs and vertex positions never change during flight; only roll and door hinge angles do.
window.createRaiderAircraft = (canvas, camera = {}) => {
  const gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false});
  if(!gl) {
    // A detailed level profile remains available on devices without WebGL.
    const ctx=canvas.getContext('2d'),image=new Image();let lastSize=120;
    const paint=size=>{lastSize=size;canvas.width=size*4;canvas.height=size*4;ctx.clearRect(0,0,canvas.width,canvas.height);if(image.complete&&image.naturalWidth)ctx.drawImage(image,0,0,image.width,image.height,size*1.05,size*1.64,size*1.90,size*.634);};
    image.onload=()=>paint(lastSize);image.src='assets/b21-side.png';
    canvas.dataset.renderer='profile-fallback';return (_bank,_doors,size)=>paint(size);
  }
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
  const program=gl.createProgram();
  gl.attachShader(program,shader(gl.VERTEX_SHADER,`
    attribute vec3 position;attribute vec2 uv;varying vec2 texUV;
    uniform float roll;uniform float projectionScale;uniform float heading;uniform float elevation;
    void main(){float c=cos(roll),s=sin(roll);float y=position.y*c-position.z*s;float z=position.y*s+position.z*c;
      float ch=cos(heading),sh=sin(heading);float x=position.x*ch-z*sh;float yawZ=position.x*sh+z*ch;
      float ce=cos(elevation),se=sin(elevation);float screenY=y*ce-yawZ*se;float depth=y*se+yawZ*ce;
      gl_Position=vec4(x*projectionScale,screenY*projectionScale,-depth/4.0,1.0);texUV=uv;}
  `));
  gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`
    precision mediump float;varying vec2 texUV;uniform sampler2D artwork;uniform vec4 tint;
    void main(){vec4 pixel=texture2D(artwork,texUV);if(pixel.a<0.5)discard;gl_FragColor=vec4(pixel.rgb*tint.rgb,1.0);}
  `));
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const locations={position:gl.getAttribLocation(program,'position'),uv:gl.getAttribLocation(program,'uv'),roll:gl.getUniformLocation(program,'roll'),heading:gl.getUniformLocation(program,'heading'),elevation:gl.getUniformLocation(program,'elevation'),projection:gl.getUniformLocation(program,'projectionScale'),tint:gl.getUniformLocation(program,'tint')};
  const makeMesh=data=>{const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);return {buffer,count:data.length/5};};
  const quad=(a,b,c,d)=>[...a,...b,...c,...a,...c,...d];
  const wingData=[],undersideData=[];
  const vertex=(u,v,bottom=false)=>{
    // Overhead atlas is nose-down: v increases toward the nose, u across the span.
    const x=.7-1.4*((v*809-132)/650),z=(u*1942-974)/1934*3.54;
    const length=Math.max(0,Math.min(1,(x+.7)/1.4));
    const y=bottom?-.017:.009+.092*Math.exp(-Math.pow((x+.28)/.48,2))*Math.exp(-z*z/.055)*Math.pow(Math.sin(Math.PI*length),.4);
    return [x,y,z,u,v];
  };
  for(let j=0;j<48;j++)for(let i=0;i<96;i++) {
    const u=i/96,v=j/48,du=1/96,dv=1/48;
    for(const [data,bottom] of [[wingData,false],[undersideData,true]])data.push(...quad(vertex(u,v,bottom),vertex(u+du,v,bottom),vertex(u+du,v+dv,bottom),vertex(u,v+dv,bottom)));
  }
  const wing=makeMesh(wingData),underside=makeMesh(undersideData);
  const profile=z=>makeMesh(quad(
    [-.7,.2675,z,26/2172,0],[.7,.2675,z,2146/2172,0],
    [.7,-.2106,z,2146/2172,1],[-.7,-.2106,z,26/2172,1]
  ));
  const profiles=[profile(-.035),profile(.035)];
  // Fixed lower fuselage cheeks occlude the internal hinges, using the same skin artwork.
  const bayCheek=z=>makeMesh(quad(...[[-.235,.022],[.135,.022],[.135,-.10],[-.235,-.10]].map(([x,y])=>[x,y,z,(26+(x+.7)/1.4*2120)/2172,(.2675-y)/.4781])));
  const bayCheeks=[bayCheek(-.15),bayCheek(.15)];
  const doorPanels=[makeMesh([]),makeMesh([])],doorEdges=makeMesh([]),bayCavity=makeMesh([]),hingeRoots=makeMesh([]);
  // Skin contour sampled from the opaque underside of the existing profile texture.
  const skin=[-.04287,-.04287,-.04287,-.04287,-.03957,-.03627,-.03428,-.03164,-.02768,-.02372,-.01910,-.01579,-.01249];
  const contour=t=>{const f=Math.max(0,Math.min(12,t*12)),i=Math.min(11,Math.floor(f));return skin[i]+(skin[i+1]-skin[i])*(f-i);};
  const updateMesh=(mesh,data)=>{gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.DYNAMIC_DRAW);mesh.count=data.length/5;};
  let lastPose={bank:0,doors:0,size:120},width=0,ratio=0,ready=0;
  const texture=url=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,0]));
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    const image=new Image();image.onload=()=>{gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);ready++;paint(lastPose.bank,lastPose.doors,lastPose.size);};image.src=url;return t;};
  const overhead=texture('assets/b21-overhead-v3.png'),side=texture('assets/b21-side.png');
  const white=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,white);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  const draw=(mesh,art,tint=[1,1,1,1])=>{gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);gl.enableVertexAttribArray(locations.position);gl.vertexAttribPointer(locations.position,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(locations.uv);gl.vertexAttribPointer(locations.uv,2,gl.FLOAT,false,20,12);gl.bindTexture(gl.TEXTURE_2D,art);gl.uniform4fv(locations.tint,tint);gl.drawArrays(gl.TRIANGLES,0,mesh.count);};
  const paint=(bank,doors,size)=>{
    lastPose={bank,doors,size};const dpr=Math.min(devicePixelRatio||1,3);
    if(width!==size||ratio!==dpr){width=size;ratio=dpr;canvas.width=Math.ceil(size*2*dpr);canvas.height=Math.ceil(size*2*dpr);}
    gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(ready<2)return;
    gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
    gl.uniform1f(locations.roll,bank*Math.PI/180);gl.uniform1f(locations.projection,camera.projection || 1/1.45);
    gl.uniform1f(locations.heading,camera.heading || 0);
    gl.uniform1f(locations.elevation,camera.elevation || 0);
    draw(underside,overhead,[.58,.62,.66,1]);draw(wing,overhead);profiles.forEach(p=>draw(p,side));
    const commandedAngle=doors*Math.PI/180,edges=[],cavity=[],roots=[];
    for(const [index,sign] of [-1,1].entries()) {
      const panel=[];
      // The near leaf opens fully while the far leaf trails slightly. From a true
      // side view this prevents the two physical leaves collapsing into one slab.
      const angle=commandedAngle*(sign<0?.82:1),hingeY=-.028,hingeZ=sign*.122;
      // Every panel vertex rotates about ONE straight fore/aft hinge; the skin never stretches.
      const point=(t,span,depth=0)=>{
        // A tiny fore/aft parallax offset reveals both leaves from the oblique
        // side camera without changing the aircraft's flight attitude.
        const x=-.205+.305*t+sign*.015+span*.022*(1-2*t),y=contour(t)+depth;
        // Beveled ends and a curved outboard edge keep each leaf part of the airframe.
        const breadth=.078*(.72+.28*Math.sin(Math.PI*t));
        const z=hingeZ-sign*breadth*span,dy=y-hingeY,dz=z-hingeZ;
        return [x,hingeY+dy*Math.cos(angle)+sign*dz*Math.sin(angle),hingeZ-sign*dy*Math.sin(angle)+dz*Math.cos(angle),.40+.14*t,.563+.023*span];
      };
      for(let j=0;j<12;j++) {
        const t=j/12,next=(j+1)/12;
        panel.push(...quad(point(t,0),point(next,0),point(next,1),point(t,1)));
        // Rolled metal edge gives the leaf thickness, rather than a floating flat card.
        edges.push(...quad(point(t,1),point(next,1),point(next,1,.0025),point(t,1,.0025)));
        // A shallow dark throat sits directly inside the skin, disappearing when latched.
        // The dark bay throat is recessed directly into the underside skin.
        const opening=.012*Math.sin(commandedAngle);
        cavity.push(...quad([-.205+.305*t,contour(t)+.002,sign*.160,0,0],[-.205+.305*next,contour(next)+.002,sign*.160,1,0],[-.205+.305*next,contour(next)-opening,sign*.160,1,1],[-.205+.305*t,contour(t)-opening,sign*.160,0,1]));
      }
      // Stiffening seams lie on the leaf and rotate with it.
      for(const t of [.22,.50,.78]) edges.push(...quad(point(t,0,.0015),point(t+.005,0,.0015),point(t+.005,1,.0015),point(t,1,.0015)));
      // Two compact hinge roots remain embedded in the fuselage as the leaf moves.
      for(const t of [.23,.70]) {
        const x=-.205+.305*t,w=.020,y=contour(t)-.002,z=hingeZ;
        roots.push(...quad([x-w,y+.006,z,0,0],[x+w,y+.006,z,1,0],[x+w,y-.010,z,1,1],[x-w,y-.010,z,0,1]));
      }
      updateMesh(doorPanels[index],panel);
    }
    updateMesh(doorEdges,edges);updateMesh(bayCavity,cavity);updateMesh(hingeRoots,roots);
    if(doors>.1)draw(bayCavity,white,[.035,.045,.052,1]);
    draw(doorPanels[0],side,[.44,.50,.55,1]);draw(doorPanels[1],side,[.90,.94,.97,1]);
    draw(doorEdges,white,[.25,.30,.34,1]);
    draw(hingeRoots,white,[.32,.38,.42,1]);
    bayCheeks.forEach(cheek=>draw(cheek,side));
    canvas.dataset.doorAngle=doors.toFixed(2);
    canvas.dataset.renderer='textured-rigid';canvas.dataset.bankAngle=bank.toFixed(2);
  };
  return paint;
};
