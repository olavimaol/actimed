"""Use NEXGROUP as the final particle target without changing the hero shapes."""
from pathlib import Path


def patch_footer(root: Path) -> None:
    path = root / '_next/static/chunks/1g7zs99-fkzkz.js'
    text = path.read_text()
    is_word = 'e.getPaths("NEXGROUP",0,0,512)' in text
    replacements = [] if is_word else [
        # Apply the existing outer-contour/holes converter to each glyph. Treating
        # all letters as a single contour would turn seven letters into holes.
        ('var t;let r,i,n=function(e){let t=e.map',
         'var t;let r,i,n=e.getPaths("NEXGROUP",0,0,512).map(glyph=>function(e){let t=e.map'),
        ('}(e.getPath("R",0,0,512).commands));return(t=new G.ShapeGeometry(n,24))',
         '}(glyph.commands)));return(t=new G.ShapeGeometry(n,24))'),
        ('let h=1,f=0,p=0,d=null,m=null,g=null,v=null,y=null,x=0,S=new G.BufferGeometry',
         'let wordScale=1,wordPointScale=1,h=1,f=0,p=0,d=null,m=null,g=null,v=null,y=null,x=0,S=new G.BufferGeometry'),
        # h also controls all early scroll geometry: adapt only the final anchors.
        ('setScale:function(e,t=f,r=p){if(h=e,w(),t>0&&r>0)',
         'setScale:function(e,t=f,r=p){if(h=e,wordScale=t>0&&r>0?Math.min(t*.88,r*2.4)/Math.max(e,1):1,wordPointScale=Math.max(.25,Math.min(.6,t/1600)),w(),t>0&&r>0)'),
        ('return{x:e.anchorX+l.x,y:e.anchorY+l.y,z:e.anchorZ+l.z}',
         'return{x:(e.anchorX+l.x)*wordScale,y:(e.anchorY+l.y)*wordScale,z:e.anchorZ+l.z}'),
        # Preserve large particles in the hero, reducing them as the word forms.
        ('m[e]=t.baseSize*R;let A=',
         'm[e]=t.baseSize*R*(D?1+(wordPointScale-1)*a:1);let A='),
    ]
    for old, new in replacements:
        count = text.count(old)
        if count != 1:
            raise ValueError(f'Footer patch expected one match, found {count}: {old[:70]}')
        text = text.replace(old, new, 1)
    # Rebalance the final anchors, leaving the early 3D particle targets intact.
    # Stratified perimeter samples avoid random gaps in the letter outlines.
    if 'uniform float uWordFormation;' not in text:
        clarity = [
            ('let r=Math.round(t*Math.min(Math.max(rA.FOOTER_R_CONTOUR_PARTICLE_RATIO,0),1))',
             'let r=Math.round(t*.55)'),
            ('let n=[];for(let e=0;e<t;e++){let e=Math.random()*i,t=r[r.length-1]',
             'let n=[],edgeCount=t;for(let edgeIndex=0;edgeIndex<edgeCount;edgeIndex++){let e=(edgeIndex+.5)*i/edgeCount,t=r[r.length-1]'),
            ('let a=Math.random(),s=t.a.x+(t.b.x-t.a.x)*a',
             'let a=Math.max(0,Math.min(1,1+e/t.len)),s=t.a.x+(t.b.x-t.a.x)*a'),
            ('return{x:(e.anchorX+l.x)*wordScale,y:(e.anchorY+l.y)*wordScale,z:e.anchorZ+l.z}',
             'return{x:(e.anchorX+l.x)*wordScale,y:(e.anchorY+l.y)*wordScale,z:(e.anchorZ+l.z)*.08}'),
            ('uniform float uHaloStrength;\n',
             'uniform float uHaloStrength;\nuniform float uWordFormation;\n'),
            ('float core = smoothstep(0.14, 0.0, dist);',
             'float core = mix(smoothstep(0.14, 0.0, dist), 1.0 - smoothstep(0.10, 0.145, dist), uWordFormation);'),
            ('uHaloStrength:{value:rA.FOOTER_PARTICLE_HALO_STRENGTH}}',
             'uHaloStrength:{value:rA.FOOTER_PARTICLE_HALO_STRENGTH},uWordFormation:{value:0}}'),
            ('function w(){b.uniforms.uLocalZExtent.value=',
             'function w(){let formation=Math.max(0,Math.min(1,rW.particleScrollState.rFormation||0));b.uniforms.uWordFormation.value=formation;b.uniforms.uHaloStrength.value=rA.FOOTER_PARTICLE_HALO_STRENGTH*(1-.92*formation);b.uniforms.uGlowBoost.value=rA.FOOTER_PARTICLE_GLOW_BOOST*(1-.8*formation);b.uniforms.uLocalZExtent.value='),
            ('g[e]=1.05+k+F', 'g[e]=1.05+(k+F)*(D?1-.8*a:1)'),
        ]
        for old, new in clarity:
            count = text.count(old)
            if count != 1:
                raise ValueError(f'Outline patch expected one match, found {count}: {old[:70]}')
            text = text.replace(old, new, 1)
    path.write_text(text)
    # The footer is shorter than the viewport. "top top" is unreachable at the
    # document bottom, leaving the farthest letters partially scattered.
    component = root / '_next/static/chunks/0zqyprg6jkh0b.js'
    footer = '"footer",{"data-dissolve":"in","data-dissolve-start":"top bottom","data-dissolve-end":"'
    component_text = component.read_text()
    old = footer + 'top top"'
    new = footer + 'bottom bottom"'
    if old not in component_text and new not in component_text:
        raise ValueError('Footer scroll trigger was not found')
    component.write_text(component_text.replace(old, new))
    for html in root.rglob('*.html'):
        page = html.read_text()
        updated = page.replace(
            '<footer data-dissolve="in" data-dissolve-start="top bottom" data-dissolve-end="top top"',
            '<footer data-dissolve="in" data-dissolve-start="top bottom" data-dissolve-end="bottom bottom"',
        )
        if updated != page:
            html.write_text(updated)


if __name__ == '__main__':
    import sys
    patch_footer(Path(sys.argv[1]))
    print('Footer particle target: NEXGROUP')
