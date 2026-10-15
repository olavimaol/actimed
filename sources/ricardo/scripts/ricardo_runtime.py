"""Adapt the public Ricardo app's runtime to the static /ricardo/ mount.

The animation components remain untouched. Only the localized navigation and
contact action are adapted because the mirror has no Next.js server.
"""

from pathlib import Path
from ricardo_footer import patch_footer


def _replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise ValueError(f"Ricardo runtime patch {label}: expected 1 match, got {count}")
    return text.replace(old, new, 1)


def patch_runtime(root: Path) -> dict[str, int]:
    """Patch copied chunks inside ``root`` (the site’s public directory)."""
    chunks = root / "_next/static/chunks"
    navigation_path = chunks / "0xgpw45d9mec1.js"
    navigation = navigation_path.read_text()
    start_marker = '},56904,e=>{"use strict";'
    end_marker = '},58620,29195,41784,e=>'
    if navigation.count(start_marker) != 1 or navigation.count(end_marker) != 1:
        raise ValueError("Cannot isolate Ricardo's localized navigation module")
    start = navigation.index(start_marker) + len(start_marker)
    end = navigation.index(end_marker, start)
    module = navigation[start:end]

    # Keep the original next-intl wrapper so explicit EN/ES links and the
    # implicit Spanish locale keep the same destination paths.
    helpers = (
        'function ricardoHref(e){'
        'if(e&&"object"==typeof e)e=(e.pathname||"/")+(e.query?y(e.query):"")+(e.hash||"");'
        'return"string"!=typeof e||!e.startsWith("/")||e.startsWith("//")||'
        '/^\\/ricardo(?:\\/|$|[?#])/.test(e)?e:"/ricardo"+e}'
        'function useRicardoPath(){return((0,t.usePathname)()||"/")'
        '.replace(/^\\/ricardo(?=\\/|$)/,"")||"/"}'
    )
    path_uses = module.count('(0,t.usePathname)()')
    if path_uses != 3:
        raise ValueError(f"Expected 3 localized pathname hooks, got {path_uses}")
    module = module.replace('(0,t.usePathname)()', 'useRicardoPath()')
    module = _replace_once(
        module,
        'var E=e.i(43476),T=',
        helpers + 'var E=e.i(43476),T=',
        "localized navigation helpers",
    )
    module = _replace_once(
        module,
        'return c&&(s=!1),(0,E.jsx)(v.default,{ref:l,href:e,hrefLang:c?r:void 0,'
        'onClick:function(e){b(i,h,u,r),o&&o(e)},prefetch:s,...a})',
        'return(0,E.jsx)("a",{...a,ref:l,href:ricardoHref(e),hrefLang:c?r:void 0,'
        'onClick:function(e){b(i,h,u,r),o&&o(e)}})',
        "native localized anchors",
    )
    module = _replace_once(
        module,
        'push:t(e.push),replace:t(e.replace),prefetch:t(e.prefetch)',
        'push:t(e=>window.location.assign(ricardoHref(e))),'
        'replace:t(e=>window.location.replace(ricardoHref(e))),prefetch:()=>{}',
        "native localized router",
    )
    navigation = navigation[:start] + module + navigation[end:]
    navigation = _replace_once(
        navigation,
        '()=>p.push(t));r?.()},[f,p])',
        '()=>p.push(t,{locale:c.locale}));r?.()},[f,p,c.locale])',
        "animated link locale forwarding",
    )
    navigation = _replace_once(
        navigation,
        'function i(e){let r=e.split("/").filter(Boolean),n=r[0];return(n&&t.locales.includes(n)&&r.shift(),0===r.length)?"/":`/${r.join("/")}`}',
        'function i(e){e=e.replace(/^\\/ricardo(?=\\/|$)/,"")||"/";'
        'let r=e.split("/").filter(Boolean),n=r[0];return(n&&t.locales.includes(n)&&r.shift(),0===r.length)?"/":`/${r.join("/")}`}',
        "particle route normalization",
    )

    contact_path = chunks / "0zqyprg6jkh0b.js"
    contact = contact_path.read_text()
    contact = _replace_once(
        contact,
        'let m=(0,p.createServerReference)("406a2f3fac1566a2ef47f9833c602d2aa93645d86a",'
        'p.callServer,void 0,p.findSourceMapURL,"sendContactEmail"),',
        'let m=async()=>({success:!1,error:"demo_only"}),',
        "local contact action",
    )
    contact = _replace_once(
        contact,
        'P({type:"error",message:(e=>{switch(e){case"missing_fields":',
        'P({type:"demo_only"===e.error?"info":"error",message:(e=>{switch(e){case"missing_fields":',
        "demo feedback style",
    )
    contact = _replace_once(
        contact,
        'case"invalid_email":return R("form.feedback.invalidEmail");default:',
        'case"invalid_email":return R("form.feedback.invalidEmail");'
        'case"demo_only":return document.documentElement.lang.startsWith("es")?'
        '"Formulario de demostración. Tu mensaje no se ha enviado.":'
        '"Demo form. Your message has not been sent.";default:',
        "explicit contact feedback",
    )

    # The production runtime conditionally injects Vercel's feedback toolbar.
    # It is unrelated to the requested site and must not run in this mirror.
    toolbar_count = 0
    runtimes = list(chunks.glob("turbopack-*.js"))
    for runtime_path in runtimes:
        runtime = runtime_path.read_text()
        marker = ';(function(){if(typeof document==="undefined"||!/(?:^|;\\s)__vercel_toolbar=1'
        if marker in runtime:
            before, toolbar = runtime.split(marker, 1)
            if "https://vercel.live/_next-live/feedback/feedback.js" not in toolbar:
                raise ValueError("Unexpected Vercel toolbar wrapper")
            runtime_path.write_text(before)
            toolbar_count += 1

    navigation_path.write_text(navigation)
    contact_path.write_text(contact)
    patch_footer(root)
    return {"localized_path_hooks": path_uses, "vercel_toolbars_removed": toolbar_count}


if __name__ == "__main__":
    import json
    import sys

    print(json.dumps(patch_runtime(Path(sys.argv[1])), indent=2))
