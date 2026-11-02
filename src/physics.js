// Pure simulation helpers, independent of the renderer.
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function circleBox(x,z,r,b){const nx=clamp(x,b.minX,b.maxX),nz=clamp(z,b.minZ,b.maxZ);return (x-nx)**2+(z-nz)**2<r*r;}
export function moveWithCollision(position,dx,dz,blocked){
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.22));let hit=false;
 for(let i=0;i<steps;i++){const x=position.x+dx/steps,z=position.z+dz/steps;if(!blocked(x,position.z))position.x=x;else hit=true;if(!blocked(position.x,z))position.z=z;else hit=true;}return hit;
}
export function driveStep(state,input,dt,maxSpeed){
 const throttle=(input.forward?1:0)-(input.backward?1:0),braking=input.brake||throttle*state.speed<0;
 const accel=braking?17:throttle?7:2.7;
 if(braking){const n=Math.max(0,Math.abs(state.speed)-accel*dt);state.speed=Math.sign(state.speed)*n;}
 else if(throttle)state.speed+=throttle*accel*dt;
 else state.speed=Math.sign(state.speed)*Math.max(0,Math.abs(state.speed)-accel*dt);
 state.speed=clamp(state.speed,-maxSpeed*.3,maxSpeed);
 const target=((input.left?1:0)-(input.right?1:0))*.48;
 state.steer+=(target-state.steer)*(1-Math.exp(-8*dt));
 state.yaw+=state.steer*state.speed/Math.max(2.1,state.wheelbase)*dt/(1+Math.abs(state.speed)*.026);
 return {dx:-Math.sin(state.yaw)*state.speed*dt,dz:-Math.cos(state.yaw)*state.speed*dt};
}
