// A persistent textured airframe, projected with a rigid rotation about its nose-tail axis.
// UVs and vertex positions never change during flight; only roll and door hinge angles do.
window.createRaiderAircraft = canvas => {
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
    uniform float roll;uniform float projectionScale;
    void main(){float c=cos(roll),s=sin(roll);float y=position.y*c-position.z*s;float z=position.y*s+position.z*c;
      gl_Position=vec4(position.x*projectionScale,y*projectionScale,-z/4.0,1.0);texUV=uv;}
  `));
  gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`
    precision mediump float;varying vec2 texUV;uniform sampler2D artwork;uniform vec4 tint;
    void main(){vec4 pixel=texture2D(artwork,texUV);if(pixel.a<0.5)discard;gl_FragColor=vec4(pixel.rgb*tint.rgb,1.0);}
  `));
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const locations={position:gl.getAttribLocation(program,'position'),uv:gl.getAttribLocation(program,'uv'),roll:gl.getUniformLocation(program,'roll'),projection:gl.getUniformLocation(program,'projectionScale'),tint:gl.getUniformLocation(program,'tint')};
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
  const doorMesh=makeMesh(new Array(60).fill(0));
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
    gl.uniform1f(locations.roll,bank*Math.PI/180);gl.uniform1f(locations.projection,1/1.45);
    draw(underside,overhead,[.58,.62,.66,1]);draw(wing,overhead);profiles.forEach(p=>draw(p,side));
    const angle=doors*Math.PI/180,data=[];
    for(const sign of [-1,1]){const z=sign*.08,y=-.05,edgeY=y-.08*Math.sin(angle),edgeZ=z-sign*.08*Math.cos(angle);data.push(...quad([-.20,y,z,0,0],[.12,y,z,1,0],[.12,edgeY,edgeZ,1,1],[-.20,edgeY,edgeZ,0,1]));}
    gl.bindBuffer(gl.ARRAY_BUFFER,doorMesh.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.DYNAMIC_DRAW);draw(doorMesh,white,[.62,.68,.73,1]);
    canvas.dataset.renderer='textured-rigid';canvas.dataset.bankAngle=bank.toFixed(2);
  };
  return paint;
};
