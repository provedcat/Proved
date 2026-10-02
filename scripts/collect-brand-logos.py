#!/usr/bin/env python3
import json, os, re, shutil, mimetypes
from io import BytesIO
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from PIL import Image

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36 ProvedBrandLogoCollector/1.1"
TIMEOUT = 25
OUT_DIR = "assets/brand-logos"
REPORT_PATH = "data/brand-logo-report.json"

def norm(s):
    return re.sub(r"[^a-z0-9가-힣]+", "", (s or "").lower())

def ascii_norm(s):
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())

def token_sources(brand):
    vals=[brand.get("name"), brand.get("name_ko")]
    vals += (brand.get("aliases") or [])
    toks=set()
    for v in vals:
        for x in re.split(r"[^A-Za-z0-9가-힣]+", v or ""):
            n=norm(x)
            if len(n)>=3: toks.add(n)
    return sorted(toks,key=len,reverse=True)

def domain_matches_brand(url, brand):
    host=ascii_norm(urlparse(url).hostname or "")
    for t in token_sources(brand):
        a=ascii_norm(t)
        if len(a)>=4 and a in host:
            return True
    return False

def pick_srcs(img):
    vals=[]
    for a in ("src","data-src","data-lazy-src","data-original","data-image"):
        if img.get(a): vals.append(img.get(a))
    for key in ("srcset","data-srcset"):
        ss=img.get(key)
        if ss:
            parts=[p.strip().split()[0] for p in ss.split(",") if p.strip()]
            vals.extend(reversed(parts))
    out=[]
    for v in vals:
        if v and v not in out: out.append(v)
    return out

def element_meta(el, src=""):
    return " ".join([
        str(el.get("alt") or ""), str(el.get("title") or ""), str(el.get("aria-label") or ""),
        " ".join(el.get("class") or []), str(el.get("id") or ""), src or ""
    ])

def direct_brand_match(meta, brand):
    n=norm(meta)
    return any(t and t in n for t in token_sources(brand))

def location_flags(el):
    flags=set()
    cur=el
    for _ in range(5):
        cur=getattr(cur,"parent",None)
        if not cur: break
        nm=getattr(cur,"name","")
        if nm in ("header","nav","footer"): flags.add(nm)
        if hasattr(cur,"get"):
            marker=(" ".join(cur.get("class") or [])+" "+str(cur.get("id") or "")).lower()
            if "header" in marker: flags.add("header")
            if "nav" in marker: flags.add("nav")
            if "footer" in marker: flags.add("footer")
    return flags

def candidate_for_img(img, absu, brand, page_url):
    meta=element_meta(img,absu)
    low=meta.lower()
    flags=location_flags(img)
    bmatch=direct_brand_match(meta,brand)
    islogo="logo" in low
    domainmatch=domain_matches_brand(page_url,brand)
    # Ignore obvious non-brand utility/payment/certification marks.
    bad=("favicon","apple-touch","payment","paypal","klarna","creditcard","visa","mastercard","certified","certification","cfia","award","badge","icon-","/icons/","sprite","pixel","tracking")
    if any(x in low for x in bad) and not bmatch:
        return None
    score=0
    if bmatch: score+=15
    if islogo: score+=8
    if "header" in flags or "nav" in flags: score+=7
    if "footer" in flags: score+=3
    if absu.lower().endswith(".svg") or ".svg?" in absu.lower(): score+=3
    elif any(x in absu.lower() for x in (".png",".webp",".avif")): score+=2
    # Conservative approval gate:
    # 1) asset itself names the brand; OR
    # 2) dedicated brand domain + explicit logo marker + appears in site chrome.
    approved_gate = bmatch or (domainmatch and islogo and bool(flags & {"header","nav","footer"}))
    if not approved_gate:
        return None
    return {"score":score,"url":absu,"kind":"img","brand_match":bmatch,"logo_marker":islogo,"location":sorted(flags),"domain_match":domainmatch}

def validate_bytes(data, ctype, url):
    c=(ctype or "").split(";")[0].strip().lower()
    low=url.lower()
    if "svg" in c or low.endswith(".svg") or data.lstrip().startswith(b"<svg"):
        if b"<svg" not in data[:6000].lower(): return False,None,None,None
        return True,"svg","image/svg+xml",None
    try:
        im=Image.open(BytesIO(data)); w,h=im.size
        if w<60 or h<20 or w*h<2500: return False,None,None,(w,h)
        fmt=(im.format or "").lower()
        ext="jpg" if fmt=="jpeg" else fmt
        mime=Image.MIME.get(im.format,c or mimetypes.guess_type("x."+ext)[0] or "application/octet-stream")
        return True,ext,mime,(w,h)
    except Exception:
        return False,None,None,None

def collect_one(session, brand):
    name,slug,page=brand["name"],brand["slug"],brand["official_url"]
    rec={"name":name,"slug":slug,"official_url":page,"status":"hold"}
    try:
        r=session.get(page,timeout=TIMEOUT,allow_redirects=True)
        rec["final_page_url"]=r.url; rec["page_status"]=r.status_code
        if r.status_code>=400:
            rec["reason"]=f"page_http_{r.status_code}"; return rec
        soup=BeautifulSoup(r.text,"html.parser")
        candidates=[]
        for img in soup.find_all("img"):
            for src in pick_srcs(img):
                if src.startswith("data:"): continue
                c=candidate_for_img(img,urljoin(r.url,src),brand,r.url)
                if c: candidates.append(c)

        # Inline SVG: accept only if it is explicitly a logo and either carries brand text
        # or lives in header/nav on a dedicated brand domain.
        for svg in soup.find_all("svg"):
            meta=element_meta(svg,"")
            flags=location_flags(svg)
            bmatch=direct_brand_match(meta,brand)
            islogo="logo" in meta.lower()
            domainmatch=domain_matches_brand(r.url,brand)
            if islogo and (bmatch or (domainmatch and bool(flags & {"header","nav"}))):
                data=str(svg).encode("utf-8")
                os.makedirs(OUT_DIR,exist_ok=True)
                fn=os.path.join(OUT_DIR,slug+".svg")
                with open(fn,"wb") as fh: fh.write(data)
                rec.update({"status":"auto_approved","asset_url":r.url+"#inline-svg","asset_kind":"inline_svg","file":fn,"mime":"image/svg+xml","score":20 if bmatch else 14,"approval_rule":"inline_svg_brand_or_dedicated_header"})
                return rec

        if not candidates:
            rec["reason"]="no_strict_logo_candidate"; return rec

        # Deduplicate URL variants and rank. Prefer direct brand match, site chrome, SVG, then score.
        uniq={}
        for c in candidates:
            key=re.sub(r"([?&])(width|height)=\d+","",c["url"],flags=re.I)
            old=uniq.get(key)
            if old is None or c["score"]>old["score"]: uniq[key]=c
        candidates=list(uniq.values())
        candidates.sort(key=lambda c:(c["brand_match"],bool(set(c["location"])&{"header","nav"}),c["url"].lower().endswith(".svg"),c["score"]),reverse=True)
        top=candidates[0]

        # If two top candidates both directly name the brand, choose the one in header/nav;
        # otherwise keep HOLD instead of guessing between valid variants.
        if len(candidates)>1:
            a,b=candidates[0],candidates[1]
            same_rank=(a["brand_match"]==b["brand_match"] and bool(set(a["location"])&{"header","nav"})==bool(set(b["location"])&{"header","nav"}) and a["score"]==b["score"])
            if same_rank and a["url"]!=b["url"]:
                rec["reason"]="ambiguous_strict_candidates"
                rec["candidates"]=candidates[:5]
                return rec

        ar=session.get(top["url"],timeout=TIMEOUT,allow_redirects=True,headers={"Referer":r.url,"User-Agent":UA})
        if ar.status_code>=400:
            rec["reason"]=f"asset_http_{ar.status_code}"; rec["asset_url"]=top["url"]; return rec
        ok,ext,mime,dims=validate_bytes(ar.content,ar.headers.get("content-type"),ar.url)
        if not ok:
            rec["reason"]="asset_validation_failed"; rec["asset_url"]=ar.url; return rec
        os.makedirs(OUT_DIR,exist_ok=True)
        fn=os.path.join(OUT_DIR,slug+"."+ext)
        with open(fn,"wb") as fh: fh.write(ar.content)
        rec.update({"status":"auto_approved","asset_url":ar.url,"asset_kind":top["kind"],"file":fn,"mime":mime,"dimensions":dims,"score":top["score"],"approval_rule":"strict_brand_asset","candidate":top})
        return rec
    except Exception as e:
        rec["reason"]="exception"; rec["error"]=repr(e)[:500]; return rec

def main():
    manifest=json.load(open("scripts/brand-logo-manifest.json",encoding="utf-8"))
    if os.path.isdir(OUT_DIR): shutil.rmtree(OUT_DIR)
    os.makedirs(OUT_DIR,exist_ok=True); os.makedirs("data",exist_ok=True)
    s=requests.Session(); s.headers.update({"User-Agent":UA,"Accept":"text/html,application/xhtml+xml,image/avif,image/webp,*/*;q=0.8"})
    report=[]
    for i,b in enumerate(manifest["brands"],1):
        print(f"[{i}/{manifest['count']}] {b['name']} -> {b['official_url']}",flush=True)
        rec=collect_one(s,b); print("   ",rec["status"],rec.get("asset_url") or rec.get("reason"),flush=True); report.append(rec)
    summary={}
    for x in report: summary[x["status"]]=summary.get(x["status"],0)+1
    with open(REPORT_PATH,"w",encoding="utf-8") as fh:
        json.dump({"summary":summary,"results":report},fh,ensure_ascii=False,indent=2)
    print("SUMMARY",summary)

if __name__=="__main__": main()
