import{r as e}from"./rolldown-runtime.DAXXjFlN.js?dpl=dpl_252g5VG1FQ1EMkJFPUPWfW8R2EWP";import{t}from"./preload-helper.L5lOfJxi.js?dpl=dpl_252g5VG1FQ1EMkJFPUPWfW8R2EWP";var n=e({getDebugGui:()=>o}),r=null,i=`
.lil-gui.root.autoPlace {
    max-height: 92vh;
    overflow-y: auto;
}
@media (max-width: 1023px), (pointer: coarse) {
    .lil-gui.root.autoPlace {
        top: auto;
        bottom: 0;
        left: 0;
        right: 0;
        width: 100%;
        max-height: 42vh;
    }
}
.lil-gui.root .title,
.lil-gui.root .controller {
    transition: opacity 0.15s;
}
.lil-gui.root.peek,
.lil-gui.root.peek .lil-gui {
    background: transparent;
}
.lil-gui.root.peek .title,
.lil-gui.root.peek .controller:not(.scrubbing) {
    opacity: 0.06;
}
`;function a(e){let t=e.domElement;t.addEventListener(`pointerdown`,e=>{let n=e.target.closest(`.controller`);n&&(n.classList.add(`scrubbing`),t.classList.add(`peek`))},{capture:!0});let n=()=>{t.classList.remove(`peek`),t.querySelectorAll(`.controller.scrubbing`).forEach(e=>e.classList.remove(`scrubbing`))};window.addEventListener(`pointerup`,n,{capture:!0}),window.addEventListener(`pointercancel`,n,{capture:!0})}function o(){return r||(r=t(async()=>{let{default:e}=await import(`./lil-gui.esm.CGHsULHj.js?dpl=dpl_252g5VG1FQ1EMkJFPUPWfW8R2EWP`);return{default:e}},[]).then(({default:e})=>{let t=new e({title:`debug`}),n=document.createElement(`style`);return n.textContent=i,document.head.appendChild(n),a(t),t}),r)}export{o as n,n as t};