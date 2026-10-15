const M=(i,o,t=1,r=1)=>{const a=Math.min(window.devicePixelRatio||1,3),n=i*t*o*t*r;return n?Math.max(1,Math.min(a,Math.sqrt(12e6/n))):a};export{M as j};
