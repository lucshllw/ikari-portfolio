import * as THREE from 'three';

export function createFrameScene(canvas: HTMLCanvasElement, fallback:()=>void) {
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:false,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.25)); renderer.setClearColor(0x000000,0);
 const scene=new THREE.Scene(); const camera=new THREE.PerspectiveCamera(32,1,.1,40); camera.position.set(0,.3,9);
 const group=new THREE.Group();scene.add(group); group.rotation.set(-.27,-.55,-.25);
 const light=new THREE.DirectionalLight(0xffffff,4);light.position.set(-4,6,5);scene.add(light);
 const fill=new THREE.DirectionalLight(0xc5b9ff,2.5);fill.position.set(4,-1,2);scene.add(fill);scene.add(new THREE.AmbientLight(0xffffff,2));
 const shape=new THREE.Shape();const w=2.45,h=2.95,r=.18;
 shape.moveTo(-w/2+r,-h/2);shape.lineTo(w/2-r,-h/2);shape.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);shape.lineTo(w/2,h/2-r);shape.quadraticCurveTo(w/2,h/2,w/2-r,h/2);shape.lineTo(-w/2+r,h/2);shape.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);shape.lineTo(-w/2,-h/2+r);shape.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
 const hole=new THREE.Path();hole.moveTo(-.95,-1.19);hole.lineTo(-.95,1.19);hole.lineTo(.95,1.19);hole.lineTo(.95,-1.19);hole.closePath();shape.holes.push(hole);
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:.11,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.045,bevelThickness:.045,curveSegments:5});
 const lavender=new THREE.MeshStandardMaterial({color:0xbcb0e8,metalness:.42,roughness:.3});const orange=new THREE.MeshStandardMaterial({color:0xee542b,metalness:.2,roughness:.28});
 const meshes:THREE.Mesh[]=[];for(let i=0;i<7;i++){const mesh=new THREE.Mesh(geometry,i===3?orange:lavender);mesh.rotation.z=i*.045;meshes.push(mesh);group.add(mesh);}
 const sphereGeometry=new THREE.SphereGeometry(.4,24,16);const orb=new THREE.Mesh(sphereGeometry,orange);orb.position.set(1.45,-1.16,.1);group.add(orb);
 let destroyed=false,visible=true,raf=0,exploded=false,rotationX=0,rotationY=0,amount=0,slow=0,last=0,start=0;
 function pose(){meshes.forEach((mesh,i)=>{mesh.position.set((i-3)*.18*amount,(i-3)*.05*amount,(i-3)*(.22+.18*amount));});group.rotation.set(-.27+rotationX,-.55+rotationY,-.25);}
 function resize(){if(destroyed)return;const rect=canvas.getBoundingClientRect();renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/Math.max(1,rect.height);camera.updateProjectionMatrix();draw();}
 function draw(){if(destroyed||!visible||document.hidden)return;pose();renderer.render(scene,camera);}
 function animate(now:number){if(destroyed||!visible||document.hidden){raf=0;return;}if(last&&now-last>45){slow++;if(slow>=8){stop();fallback();return;}}else slow=Math.max(0,slow-1);last=now;const progress=Math.min(1,(now-start)/800);const eased=1-Math.pow(1-progress,3);amount=exploded?eased:1-eased;draw();if(progress<1)raf=requestAnimationFrame(animate);else raf=0;}
 function stop(){cancelAnimationFrame(raf);raf=0;last=0;}
 function toggle(value:boolean){exploded=value;stop();start=performance.now();raf=requestAnimationFrame(animate);}
 function move(x:number,y:number){rotationX=y*.12;rotationY=x*.18;draw();}
 function lost(event:Event){event.preventDefault();stop();fallback();}
 canvas.addEventListener('webglcontextlost',lost);
 const observer=new ResizeObserver(resize);observer.observe(canvas);
 function visibility(){if(document.hidden)stop();else draw();}document.addEventListener('visibilitychange',visibility);
 resize();
 return {toggle,move,setVisible(value:boolean){visible=value;if(!value)stop();else draw();},dispose(){if(destroyed)return;destroyed=true;stop();observer.disconnect();canvas.removeEventListener('webglcontextlost',lost);document.removeEventListener('visibilitychange',visibility);geometry.dispose();sphereGeometry.dispose();lavender.dispose();orange.dispose();renderer.dispose();renderer.forceContextLoss();}};
}
